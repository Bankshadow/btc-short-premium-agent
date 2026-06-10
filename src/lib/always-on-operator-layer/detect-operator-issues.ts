import type { BinancePosition, BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import { reconcileBinancePositions } from "@/lib/exchange/binance/binance-position-monitor";
import type { MonitorHeartbeat, MonitorIssue } from "@/lib/monitor-reliability/types";
import { MONITOR_STALE_MS } from "@/lib/monitor-reliability/types";
import type { MissionMode } from "@/lib/mission-controller-risk-budget/types";
import type { OperatorLayerAlert } from "./types";

const MAX_HOLD_HOURS = 24;

function alert(
  partial: Omit<OperatorLayerAlert, "alertId"> & { alertId?: string },
): OperatorLayerAlert {
  return {
    alertId: partial.alertId ?? `ola-${partial.kind}-${Date.now()}`,
    ...partial,
  };
}

export function detectStuckPositions(input: {
  journal: BinanceTestnetJournalEntry[];
  positions: BinancePosition[];
  nowMs?: number;
}): OperatorLayerAlert[] {
  const now = input.nowMs ?? Date.now();
  const openPositions = input.positions.filter(
    (p) => Math.abs(Number(p.positionAmt)) > 0,
  );
  const alerts: OperatorLayerAlert[] = [];

  for (const pos of openPositions) {
    const journalRow = input.journal.find(
      (j) =>
        j.symbol === pos.symbol &&
        ["FILLED", "SUBMITTED", "CLOSING"].includes(j.status),
    );
    const openedAt = journalRow?.createdAt
      ? Date.parse(journalRow.createdAt)
      : null;
    const openHours =
      openedAt && Number.isFinite(openedAt)
        ? (now - openedAt) / (60 * 60 * 1000)
        : null;

    if (openHours != null && openHours >= MAX_HOLD_HOURS) {
      alerts.push(
        alert({
          kind: "stuck_position",
          severity: "WARNING",
          title: `Stuck position · ${pos.symbol}`,
          message: `${pos.symbol} open ${openHours.toFixed(1)}h — exceeds ${MAX_HOLD_HOURS}h max hold.`,
          symbol: pos.symbol,
        }),
      );
    }
  }

  return alerts;
}

export function detectMissingJournalIssues(input: {
  journal: BinanceTestnetJournalEntry[];
  positions: BinancePosition[];
}): OperatorLayerAlert[] {
  const alerts: OperatorLayerAlert[] = [];
  const reconcile = reconcileBinancePositions({
    positions: input.positions,
    journal: input.journal,
  });

  for (const mismatch of reconcile.mismatches) {
    if (mismatch.includes("no matching journal")) {
      alerts.push(
        alert({
          kind: "missing_journal",
          severity: "CRITICAL",
          title: "Missing journal entry",
          message: mismatch,
          symbol: mismatch.match(/on (\w+)/)?.[1] ?? null,
        }),
      );
    }
  }

  for (const entry of input.journal) {
    if (entry.status === "CLOSED" && !entry.decisionLogId) {
      alerts.push(
        alert({
          kind: "missing_journal",
          severity: "WARNING",
          title: "Closed trade missing decision link",
          message: `Journal ${entry.binanceTestnetTradeId} closed without decisionLogId.`,
          symbol: entry.symbol,
        }),
      );
    }
  }

  return alerts;
}

export function alertsFromMonitorIssues(issues: MonitorIssue[]): OperatorLayerAlert[] {
  return issues
    .filter((i) => !i.recovered)
    .map((i) =>
      alert({
        kind:
          i.kind === "monitor_not_running" || i.kind === "position_not_monitored"
            ? "monitor_stale"
            : i.kind === "position_state_uncertain" ||
                i.kind === "exchange_closed_not_journaled"
              ? "missing_journal"
              : "action_required",
        severity: i.severity,
        title: i.kind.replace(/_/g, " "),
        message: i.message,
        symbol: i.symbol,
      }),
    );
}

export function buildOperatorAlerts(input: {
  monitorIssues: MonitorIssue[];
  stuckAlerts: OperatorLayerAlert[];
  missingJournalAlerts: OperatorLayerAlert[];
  missionMode: MissionMode | null;
  permissionPending: boolean;
  heartbeat: MonitorHeartbeat;
  openPositionCount: number;
  autoExecuteEnabled: boolean;
  connected: boolean;
}): OperatorLayerAlert[] {
  const merged = new Map<string, OperatorLayerAlert>();

  const push = (a: OperatorLayerAlert) => {
    const key = `${a.kind}:${a.symbol ?? ""}:${a.message.slice(0, 80)}`;
    if (!merged.has(key)) merged.set(key, a);
  };

  for (const a of alertsFromMonitorIssues(input.monitorIssues)) push(a);
  for (const a of input.stuckAlerts) push(a);
  for (const a of input.missingJournalAlerts) push(a);

  if (input.missionMode === "PAUSED") {
    push(
      alert({
        kind: "mission_paused",
        severity: "CRITICAL",
        title: "Mission PAUSED",
        message: "Daily loss limit or critical blocker — no new testnet entries.",
        symbol: null,
      }),
    );
  } else if (
    input.missionMode === "COOLDOWN" ||
    input.missionMode === "DEFENSIVE"
  ) {
    push(
      alert({
        kind: "risk_elevated",
        severity: "WARNING",
        title: `Mission ${input.missionMode}`,
        message: `Risk posture ${input.missionMode} — review recommended limits.`,
        symbol: null,
      }),
    );
  }

  if (input.permissionPending) {
    push(
      alert({
        kind: "permission_pending",
        severity: "WARNING",
        title: "Permission pending",
        message: "Testnet action awaiting /approve or /deny.",
        symbol: null,
      }),
    );
  }

  if (
    input.autoExecuteEnabled &&
    input.connected &&
    input.openPositionCount > 0 &&
    input.heartbeat.lastMonitorRunAt
  ) {
    const stale =
      Date.now() - Date.parse(input.heartbeat.lastMonitorRunAt) > MONITOR_STALE_MS;
    if (stale) {
      push(
        alert({
          kind: "monitor_stale",
          severity: "CRITICAL",
          title: "Monitor heartbeat stale",
          message: `Last monitor run ${input.heartbeat.lastMonitorRunAt}.`,
          symbol: null,
        }),
      );
    }
  }

  return [...merged.values()];
}

export function fingerprintAlerts(alerts: OperatorLayerAlert[]): string {
  return alerts
    .map((a) => `${a.kind}:${a.severity}:${a.symbol ?? ""}:${a.title}`)
    .sort()
    .join("|");
}
