import { loadAutomationState } from "@/lib/automation-control-plane/state-store";
import { getBtcTicker } from "@/lib/bybit/tickers";
import {
  getBinanceStatus,
  getPositions,
} from "@/lib/exchange/binance/binance-futures-testnet";
import { loadServerBinanceTestnetJournal } from "@/lib/exchange/binance/binance-testnet-journal-server";
import { isBinanceTestnetAutoExecuteEnabled } from "@/lib/exchange/binance/binance-config";
import { GOAL_START_CAPITAL } from "@/lib/goal-engine/types";
import { buildMonitorReliabilitySnapshot } from "@/lib/monitor-reliability";
import { dailyLossLimitHit } from "@/lib/mission-controller-risk-budget/resolve-mission-mode";
import type { MissionMode } from "@/lib/mission-controller-risk-budget/types";
import { emitMissionAlert } from "@/lib/mission-notifications/emit-mission-alert";
import { recordMonitorEvent } from "@/lib/testnet-monitor/monitor-journal-server";
import {
  isTelegramControlEnabled,
  syncTelegramControlChannel,
} from "@/lib/telegram-control-channel";
import { loadTelegramControlState } from "@/lib/telegram-control-channel/store";
import { isPermissionPromptActive } from "@/lib/telegram-control-channel/store";
import { runDailySelfReview } from "@/lib/daily-self-review/run-daily-self-review";
import {
  buildOperatorAlerts,
  detectMissingJournalIssues,
  detectStuckPositions,
  fingerprintAlerts,
} from "./detect-operator-issues";
import { patchOperatorLayerHeartbeat, loadOperatorLayerHeartbeat } from "./operator-heartbeat-store";
import type {
  AlwaysOnOperatorLayerSnapshot,
  OperatorLayerStepResult,
  OperatorLayerTickInput,
} from "./types";
import {
  ALWAYS_ON_OPERATOR_LAYER_LABEL,
  ALWAYS_ON_OPERATOR_LAYER_MVP,
  OPERATOR_LAYER_SAFETY_NOTICE,
} from "./types";

function stepResult(
  step: OperatorLayerStepResult["step"],
  ok: boolean,
  summary: string,
  started: number,
): OperatorLayerStepResult {
  return {
    step,
    ok,
    summary,
    durationMs: Date.now() - started,
  };
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function deriveNextAction(input: {
  actionRequired: boolean;
  alerts: AlwaysOnOperatorLayerSnapshot["alerts"];
  permissionPending: boolean;
}): string {
  if (input.permissionPending) {
    return "Testnet permission pending — use /approve or /deny in Telegram.";
  }
  const critical = input.alerts.find((a) => a.severity === "CRITICAL");
  if (critical) return critical.message;
  if (input.actionRequired) {
    return input.alerts[0]?.message ?? "Review operator alerts in Reports.";
  }
  return "Monitoring active — no operator action required.";
}

/**
 * Always-on operator tick — monitoring and reporting only.
 * **Never opens orders or enables live trading.**
 */
export async function runOperatorLayerTick(
  input: OperatorLayerTickInput = {},
): Promise<AlwaysOnOperatorLayerSnapshot> {
  const trigger = input.trigger ?? "cron";
  const workspaceId = input.workspaceId ?? "server-default";
  const steps: OperatorLayerStepResult[] = [];
  const tickStarted = Date.now();

  let btcPrice: number | null = null;
  let openPositionCount = 0;
  let dailyPnlUsd = 0;
  let netPnlUsd = 0;
  let missionMode: MissionMode | null = null;
  let dailyReportGenerated = false;
  let dailyReportSummary: string | null = null;
  let telegramNotified = false;
  let alerts: AlwaysOnOperatorLayerSnapshot["alerts"] = [];

  const s0 = Date.now();
  const heartbeatBase = await loadOperatorLayerHeartbeat();
  await patchOperatorLayerHeartbeat({
    lastTickAt: new Date().toISOString(),
    tickCount: heartbeatBase.tickCount + 1,
  });
  steps.push(stepResult("heartbeat", true, "Operator heartbeat recorded.", s0));

  const s1 = Date.now();
  try {
    const ticker = await getBtcTicker();
    btcPrice = ticker?.price ?? null;
    await patchOperatorLayerHeartbeat({ lastMarketRefreshAt: new Date().toISOString() });
    steps.push(
      stepResult(
        "refresh_market_data",
        btcPrice != null,
        btcPrice != null ? `BTC ${btcPrice.toLocaleString()}` : "Market ticker unavailable.",
        s1,
      ),
    );
  } catch (error) {
    steps.push(
      stepResult(
        "refresh_market_data",
        false,
        error instanceof Error ? error.message : "Market refresh failed.",
        s1,
      ),
    );
  }

  const journal = await loadServerBinanceTestnetJournal().catch(() => []);
  const status = await getBinanceStatus().catch(() => ({
    connected: false,
    error: "status unavailable",
  }));
  let positions: Awaited<ReturnType<typeof getPositions>> = [];
  const s2 = Date.now();
  try {
    if (status.connected) {
      positions = await getPositions();
    }
    openPositionCount = positions.filter(
      (p) => Math.abs(Number(p.positionAmt)) > 0,
    ).length;
    await patchOperatorLayerHeartbeat({
      lastPositionRefreshAt: new Date().toISOString(),
    });
    steps.push(
      stepResult(
        "refresh_positions",
        status.connected,
        status.connected
          ? `${openPositionCount} open position(s) · Binance testnet connected.`
          : `Binance disconnected: ${status.error ?? "unknown"}.`,
        s2,
      ),
    );
  } catch (error) {
    steps.push(
      stepResult(
        "refresh_positions",
        false,
        error instanceof Error ? error.message : "Position refresh failed.",
        s2,
      ),
    );
  }

  const s3 = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  dailyPnlUsd = journal
    .filter(
      (j) =>
        j.status === "CLOSED" &&
        new Date(j.closedAt ?? j.createdAt).getTime() >= todayStart.getTime(),
    )
    .reduce((sum, j) => sum + (j.realizedPnl ?? 0), 0);
  netPnlUsd = journal
    .filter((j) => j.status === "CLOSED")
    .reduce((sum, j) => sum + (j.realizedPnl ?? 0), 0);
  await patchOperatorLayerHeartbeat({ lastPnlUpdateAt: new Date().toISOString() });
  steps.push(
    stepResult(
      "update_pnl",
      true,
      `Daily ${dailyPnlUsd >= 0 ? "+" : ""}${dailyPnlUsd.toFixed(2)} · net ${netPnlUsd >= 0 ? "+" : ""}${netPnlUsd.toFixed(2)} USD.`,
      s3,
    ),
  );

  const s4 = Date.now();
  const equityUsd = GOAL_START_CAPITAL + netPnlUsd;
  const dailyPnlPct =
    equityUsd > 0 ? (dailyPnlUsd / equityUsd) * 100 : 0;
  if (dailyLossLimitHit(dailyPnlPct)) {
    missionMode = "PAUSED";
  }
  const automationState = await loadAutomationState(workspaceId);
  if (automationState.settings.paused) {
    missionMode = "PAUSED";
  }
  await patchOperatorLayerHeartbeat({ lastRiskCheckAt: new Date().toISOString() });
  steps.push(
    stepResult(
      "check_risk",
      true,
      missionMode
        ? `Mission mode ${missionMode} · daily PnL ${dailyPnlPct.toFixed(2)}%.`
        : `Risk check OK · daily PnL ${dailyPnlPct.toFixed(2)}%.`,
      s4,
    ),
  );

  const monitorReliability = await buildMonitorReliabilitySnapshot({
    journal,
    positions,
    connected: status.connected,
    autoExecuteEnabled: isBinanceTestnetAutoExecuteEnabled(),
    autoRecover: false,
  });

  const s5 = Date.now();
  const stuckAlerts = detectStuckPositions({ journal, positions });
  steps.push(
    stepResult(
      "detect_stuck_position",
      stuckAlerts.length === 0,
      stuckAlerts.length
        ? `${stuckAlerts.length} stuck position alert(s).`
        : "No stuck positions detected.",
      s5,
    ),
  );

  const s6 = Date.now();
  const missingJournalAlerts = detectMissingJournalIssues({ journal, positions });
  steps.push(
    stepResult(
      "detect_missing_journal",
      missingJournalAlerts.length === 0,
      missingJournalAlerts.length
        ? `${missingJournalAlerts.length} journal gap(s) detected.`
        : "Journal linkage OK.",
      s6,
    ),
  );

  const tgState = await loadTelegramControlState().catch(() => null);
  const permissionPending = Boolean(
    tgState?.lastPermissionPrompt &&
      isPermissionPromptActive(tgState.lastPermissionPrompt),
  );

  alerts = buildOperatorAlerts({
    monitorIssues: monitorReliability.issues,
    stuckAlerts,
    missingJournalAlerts,
    missionMode,
    permissionPending,
    heartbeat: monitorReliability.heartbeat,
    openPositionCount,
    autoExecuteEnabled: isBinanceTestnetAutoExecuteEnabled(),
    connected: status.connected,
  });

  const actionRequired = alerts.some(
    (a) => a.severity === "CRITICAL" || a.severity === "WARNING",
  );

  const s7 = Date.now();
  const allowDaily =
    input.allowDailyReport ??
    new Date().getHours() >= 23;
  const heartbeat = await loadOperatorLayerHeartbeat();
  const dailyAlready =
    heartbeat.lastDailyReportAt?.slice(0, 10) === todayKey();

  if (allowDaily && !dailyAlready) {
    try {
      const review = await runDailySelfReview({
        workspaceId,
        trigger: "automation",
      });
      if (review.record) {
        dailyReportGenerated = true;
        dailyReportSummary = review.record.summary ?? null;
        await patchOperatorLayerHeartbeat({
          lastDailyReportAt: new Date().toISOString(),
        });
      }
      steps.push(
        stepResult(
          "generate_daily_report",
          Boolean(review.record),
          review.skipped
            ? `Daily report skipped: ${review.reason ?? "already run"}.`
            : dailyReportGenerated
              ? "Daily self-review generated."
              : "Daily report not produced.",
          s7,
        ),
      );
    } catch (error) {
      steps.push(
        stepResult(
          "generate_daily_report",
          false,
          error instanceof Error ? error.message : "Daily report failed.",
          s7,
        ),
      );
    }
  } else {
    steps.push(
      stepResult(
        "generate_daily_report",
        true,
        dailyAlready ? "Daily report already run today." : "Not scheduled this tick.",
        s7,
      ),
    );
  }

  const s8 = Date.now();
  const alertFingerprint = fingerprintAlerts(alerts);
  const shouldNotify =
    actionRequired && alertFingerprint !== heartbeat.lastAlertFingerprint;

  if (shouldNotify) {
    const top = alerts.slice(0, 3).map((a) => `· ${a.title}: ${a.message}`).join("\n");
    const notify = await emitMissionAlert({
      kind: "blocker",
      title: "Operator action needed",
      body: top,
    });
    telegramNotified = notify.sent;

    if (isTelegramControlEnabled()) {
      await syncTelegramControlChannel({
        workspaceId,
        sendPermissionPrompt: permissionPending,
      }).catch(() => undefined);
    }

    await patchOperatorLayerHeartbeat({
      lastTelegramNotifyAt: new Date().toISOString(),
      lastAlertFingerprint: alertFingerprint,
    });
  }
  steps.push(
    stepResult(
      "telegram_notify",
      true,
      shouldNotify
        ? telegramNotified
          ? "Telegram notification sent."
          : "Notification skipped (prefs or config)."
        : "No new alerts to notify.",
      s8,
    ),
  );

  const finalHeartbeat = await patchOperatorLayerHeartbeat({
    lastSuccessfulTickAt: new Date().toISOString(),
  });

  const snapshot: AlwaysOnOperatorLayerSnapshot = {
    mvp: ALWAYS_ON_OPERATOR_LAYER_MVP,
    label: ALWAYS_ON_OPERATOR_LAYER_LABEL,
    trigger,
    heartbeat: finalHeartbeat,
    steps,
    alerts,
    actionRequired,
    nextAction: deriveNextAction({ actionRequired, alerts, permissionPending }),
    btcPrice,
    openPositionCount,
    dailyPnlUsd,
    netPnlUsd,
    missionMode,
    dailyReportGenerated,
    dailyReportSummary,
    telegramNotified,
    cannotOpenOrders: true,
    telegramCannotEnableLive: true,
    testnetExecuteRequiresApproval: true,
    safetyNotice: OPERATOR_LAYER_SAFETY_NOTICE,
    lastUpdatedAt: new Date().toISOString(),
  };

  await recordMonitorEvent({
    exchange: "BINANCE",
    environment: "TESTNET",
    eventType: "OPERATOR_LAYER_TICK",
    symbol: null,
    decisionLogId: null,
    orderId: null,
    positionId: null,
    payload: {
      trigger,
      actionRequired,
      alertCount: alerts.length,
      missionMode,
      durationMs: Date.now() - tickStarted,
      cannotOpenOrders: true,
    },
  }).catch(() => undefined);

  await writeOperatorLayerSnapshot(snapshot);

  return snapshot;
}

const SNAPSHOT_FILE = "operator-layer-last-snapshot.json";

async function writeOperatorLayerSnapshot(
  snapshot: AlwaysOnOperatorLayerSnapshot,
): Promise<void> {
  const { writeCronJsonFile } = await import("@/lib/cron/cron-config");
  await writeCronJsonFile(SNAPSHOT_FILE, snapshot);
}

export async function loadOperatorLayerSnapshot(): Promise<AlwaysOnOperatorLayerSnapshot | null> {
  const { readCronJsonFile } = await import("@/lib/cron/cron-config");
  const { emptyAlwaysOnOperatorLayer } = await import("./empty-snapshot");
  const parsed = await readCronJsonFile<AlwaysOnOperatorLayerSnapshot | null>(
    SNAPSHOT_FILE,
    null,
  );
  if (!parsed || parsed.mvp !== ALWAYS_ON_OPERATOR_LAYER_MVP) {
    return emptyAlwaysOnOperatorLayer();
  }
  return parsed;
}
