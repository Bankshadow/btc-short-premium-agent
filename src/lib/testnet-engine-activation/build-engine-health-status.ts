import { loadCentralAnalysisBundle } from "@/lib/analysis-engine/analysis-orchestrator";
import { probeJournalWritable } from "@/lib/cron/ensure-journal-dir";
import { getBinanceStatus } from "@/lib/exchange/binance/binance-futures-testnet";
import { loadGovernanceState } from "@/lib/governance/governance-state";
import { loadIncidents } from "@/lib/governance/incidents-store";
import { loadServerAnalysisJournal } from "@/lib/journal/journal-server-store";
import { filterProductionEntries, filterProductionOrders } from "@/lib/journal/production-filter";
import { readMissionSnapshotCache } from "@/lib/mission-flow/snapshot-cache";
import { listWarehouseRows } from "@/lib/db/repositories/warehouse-repository";
import { loadLearningRecordsServer } from "@/lib/testnet-monitor/learning-records-server";
import { loadMonitorJournalEvents } from "@/lib/testnet-monitor/monitor-journal-server";
import { readTestnetMonitorSnapshotCache } from "@/lib/testnet-monitor/snapshot-cache";
import { queryEngineEvents } from "@/lib/engine-event-bus/engine-event-store";
import { evaluateKillSwitch } from "@/lib/validation/kill-switch";
import { getDeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import { GOAL_MIN_TRADES_FOR_TRUST } from "@/lib/goal-engine/types";
import { resolveBinanceTestnetDiagnosticFromStatus } from "./build-binance-testnet-diagnostic";
import {
  TESTNET_ENGINE_ACTIVATION_MVP,
  type EngineActivationHealthCheck,
  type EngineActivationHealthResponse,
  type EngineActivationHealthStatus,
} from "./types";

function check(
  id: string,
  name: string,
  status: EngineActivationHealthStatus,
  reason: string,
  lastCheckedAt: string | null = null,
): EngineActivationHealthCheck {
  return { id, name, status, reason, lastCheckedAt };
}

function worstStatus(checks: EngineActivationHealthCheck[]): EngineActivationHealthStatus {
  if (checks.some((c) => c.status === "BLOCKED")) return "BLOCKED";
  if (checks.some((c) => c.status === "WARNING")) return "WARNING";
  return "OK";
}

/** Lightweight MVP 95 health — no fresh mission/testnet rebuild. */
export async function buildEngineActivationHealthStatus(): Promise<EngineActivationHealthResponse> {
  const updatedAt = new Date().toISOString();
  const checks: EngineActivationHealthCheck[] = [];

  const [
    binanceStatus,
    journalProbe,
    entriesRaw,
    paperRows,
    monitorEvents,
    learningRecords,
    centralBundle,
    recentEventsResult,
  ] = await Promise.all([
    getBinanceStatus().catch(() => null),
    probeJournalWritable(),
    loadServerAnalysisJournal().catch(() => []),
    listWarehouseRows("paper_trades", 500).catch(() => [] as PaperOrder[]),
    loadMonitorJournalEvents().catch(() => []),
    loadLearningRecordsServer().catch(() => []),
    loadCentralAnalysisBundle().catch(() => ({
      state: { latestDecisionLogId: null, latestResultAt: null, latestRunId: null },
      latest: null,
      events: [],
    })),
    queryEngineEvents({ limit: 5 }).catch(() => ({ events: [], total: 0 })),
  ]);

  const recentEvents = recentEventsResult.events;

  const mission = readMissionSnapshotCache()?.snapshot ?? null;
  const testnet = readTestnetMonitorSnapshotCache()?.snapshot ?? null;
  const entries = filterProductionEntries(entriesRaw);
  const orders = filterProductionOrders(
    Array.isArray(paperRows) ? (paperRows as PaperOrder[]) : [],
  );
  const binanceDiag = resolveBinanceTestnetDiagnosticFromStatus(binanceStatus);

  checks.push(
    check(
      "missionSnapshot",
      "Mission snapshot",
      mission ? "OK" : "WARNING",
      mission
        ? `Cached mission snapshot · ${mission.lastUpdatedAt}`
        : "No cached mission snapshot — run Start AI or wait for cron.",
      mission?.lastUpdatedAt ?? null,
    ),
  );

  checks.push(
    check(
      "decisionLog",
      "Decision log",
      entries.length > 0 ? "OK" : "WARNING",
      entries.length > 0
        ? `${entries.length} decision(s) · head ${entries[0]?.id.slice(0, 12) ?? "—"}…`
        : "No decision log entries yet — run Start AI.",
      entries[0]?.timestamp ?? null,
    ),
  );

  checks.push(
    check(
      "journal",
      "Monitor journal writable",
      journalProbe.ok ? "OK" : "BLOCKED",
      journalProbe.ok
        ? "Journal data directory writable."
        : journalProbe.error ?? "Journal not writable.",
      updatedAt,
    ),
  );

  checks.push(
    check(
      "tradeStore",
      "Trade store",
      testnet || orders.length > 0 ? "OK" : "WARNING",
      testnet
        ? `${testnet.closedTrades.length} closed testnet trade(s) in monitor.`
        : orders.length > 0
          ? `${orders.length} paper order(s) in warehouse.`
          : "No trades recorded yet.",
      testnet?.lastUpdatedAt ?? null,
    ),
  );

  checks.push(
    check(
      "binanceTestnet",
      "Binance testnet",
      binanceDiag.status === "CONNECTED"
        ? "OK"
        : binanceDiag.status === "MISSING_ENV" ||
            binanceDiag.status === "AUTH_ERROR" ||
            binanceDiag.status === "CLOCK_SKEW"
          ? "BLOCKED"
          : "WARNING",
      binanceDiag.reason,
      binanceDiag.lastCheckedAt,
    ),
  );

  const monitorReliability = testnet?.monitorReliability ?? mission?.monitorReliability;
  checks.push(
    check(
      "positionMonitor",
      "Position monitor",
      monitorReliability?.health === "BLOCKED"
        ? "BLOCKED"
        : monitorReliability?.positionStateUncertain
          ? "WARNING"
          : "OK",
      monitorReliability?.currentIssue ??
        (monitorReliability ? "Monitor reliability OK." : "Monitor not evaluated yet."),
      testnet?.lastUpdatedAt ?? mission?.lastUpdatedAt ?? null,
    ),
  );

  const pendingLearning =
    testnet?.learningRecords.filter((r) => r.status === "PENDING_REVIEW").length ??
    learningRecords.filter((r) => r.status === "PENDING_REVIEW").length;
  checks.push(
    check(
      "learningQueue",
      "Learning queue",
      pendingLearning > 5 ? "WARNING" : "OK",
      pendingLearning > 0
        ? `${pendingLearning} pending review · ${learningRecords.length} record(s).`
        : `${learningRecords.length} learning record(s).`,
      testnet?.lastUpdatedAt ?? null,
    ),
  );

  const evidenceCount =
    testnet?.evidenceProgress.completedTrades ??
    mission?.evidenceProgress.completedTrades ??
    0;
  checks.push(
    check(
      "reports",
      "Reports pipeline",
      evidenceCount >= GOAL_MIN_TRADES_FOR_TRUST ? "OK" : "WARNING",
      evidenceCount >= GOAL_MIN_TRADES_FOR_TRUST
        ? `${evidenceCount} valid evidence trades for trust.`
        : `${evidenceCount}/${GOAL_MIN_TRADES_FOR_TRUST} evidence trades toward trust.`,
      testnet?.lastUpdatedAt ?? mission?.lastUpdatedAt ?? null,
    ),
  );

  const strategyBlocks =
    testnet?.integratedStrategyHealth.blocksNewTestnetEntries ??
    mission?.integratedStrategyHealth.blocksNewTestnetEntries ??
    false;
  checks.push(
    check(
      "riskGate",
      "Risk gate",
      strategyBlocks ? "WARNING" : "OK",
      strategyBlocks
        ? mission?.integratedStrategyHealth.primaryReport?.recommendation ??
          "Strategy health blocking new testnet entries."
        : "No active strategy health block on entries.",
      mission?.integratedStrategyHealth.primaryReport?.reviewedAt ?? null,
    ),
  );

  const governance = loadGovernanceState();
  const incidents = loadIncidents().filter(
    (i) => i.status === "open" || i.status === "investigating",
  );
  checks.push(
    check(
      "governance",
      "Governance",
      governance.safeMode || governance.pauseAnalysis
        ? "BLOCKED"
        : incidents.length > 0
          ? "WARNING"
          : "OK",
      governance.safeMode
        ? "Governance safe mode active."
        : governance.pauseAnalysis
          ? "Governance paused analysis."
          : incidents.length > 0
            ? `${incidents.length} open incident(s) — review governance.`
            : "Governance checks nominal.",
      null,
    ),
  );

  const kill = evaluateKillSwitch({
    entries,
    orders,
    riskProfile: getDeskRiskProfile(),
  });
  checks.push(
    check(
      "killSwitch",
      "Kill switch",
      kill.tradingPaused ? "BLOCKED" : "OK",
      kill.tradingPaused
        ? kill.messages[0] ?? "Kill switch paused trading."
        : "Kill switch inactive.",
      null,
    ),
  );

  checks.push(
    check(
      "settings",
      "Automation settings",
      mission?.automation.paused ? "WARNING" : "OK",
      mission?.automation.paused
        ? "Autopilot paused by operator."
        : mission?.automation.enabled === false
          ? "Automation disabled in settings."
          : `Automation interval ${mission?.automation.intervalMinutes ?? 15}m.`,
      mission?.automation.lastRunAt ?? null,
    ),
  );

  checks.push(
    check(
      "eventBus",
      "Engine event bus",
      recentEvents.length > 0 || centralBundle.state.latestRunId ? "OK" : "WARNING",
      recentEvents.length > 0
        ? `${recentEvents.length} recent engine event(s).`
        : centralBundle.state.latestRunId
          ? `Last run ${centralBundle.state.latestRunId.slice(0, 16)}… — no recent bus events.`
          : "No engine events yet — run Start AI or Run cycle now.",
      recentEvents[0]?.timestamp ?? centralBundle.state.latestResultAt ?? null,
    ),
  );

  const status = worstStatus(checks);
  const blockers = checks
    .filter((c) => c.status === "BLOCKED")
    .map((c) => c.reason);
  const warnings = checks
    .filter((c) => c.status === "WARNING")
    .map((c) => c.reason);

  return {
    mvp: TESTNET_ENGINE_ACTIVATION_MVP,
    status,
    checks,
    blockers,
    warnings,
    updatedAt,
    liveTradingLocked: true,
  };
}

export function withActivationTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}
