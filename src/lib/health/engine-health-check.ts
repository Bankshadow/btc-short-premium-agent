import { getEvents } from "@/lib/journal/journal-query";
import type { JournalEvent } from "@/lib/journal/journal-types";
import { buildOpenTradesFromEvents } from "@/lib/trades/trade-store";
import { getLatestMonitoredSnapshots } from "@/lib/positions/position-monitor";
import { POSITION_REFRESH_STALE_MS } from "@/lib/positions/position-types";
import type { EngineHealthIssue, EngineHealthReport } from "./engine-health-types";

export function checkStateConsistency(events: JournalEvent[]) {
  const issues: EngineHealthIssue[] = [];
  const orphanTrades: string[] = [];
  const missingPnlTrades: string[] = [];
  const stalePositionTrades: string[] = [];
  const now = Date.now();

  const executed = events.filter((e) => e.type === "ORDER_EXECUTED" && e.tradeId);
  const opened = new Set(
    events.filter((e) => e.type === "POSITION_OPENED").map((e) => e.tradeId).filter(Boolean),
  );
  for (const evt of executed) {
    if (!opened.has(evt.tradeId)) {
      orphanTrades.push(evt.tradeId!);
      issues.push({
        code: "ORPHAN_ORDER_EXECUTED",
        severity: "WARNING",
        message: `ORDER_EXECUTED without POSITION_OPENED for ${evt.tradeId}.`,
      });
    }
  }

  const closedIds = events
    .filter((e) => e.type === "POSITION_CLOSED" && e.tradeId)
    .map((e) => e.tradeId as string);
  for (const tradeId of closedIds) {
    const hasPnl = events.some((e) => e.type === "PNL_REALIZED" && e.tradeId === tradeId);
    if (!hasPnl) {
      missingPnlTrades.push(tradeId);
      issues.push({
        code: "MISSING_PNL_REALIZED",
        severity: "WARNING",
        message: `POSITION_CLOSED without PNL_REALIZED for ${tradeId}.`,
      });
    }
  }

  const openTrades = buildOpenTradesFromEvents(events);
  const snapshots = getLatestMonitoredSnapshots(events);
  for (const trade of openTrades) {
    const snap = snapshots.get(trade.tradeId);
    if (!snap) {
      stalePositionTrades.push(trade.tradeId);
      issues.push({
        code: "NEVER_MONITORED",
        severity: "WARNING",
        message: `Open trade ${trade.tradeId} never monitored.`,
      });
      continue;
    }
    const age = now - Date.parse(snap.refreshedAt);
    if (age > POSITION_REFRESH_STALE_MS) {
      stalePositionTrades.push(trade.tradeId);
      issues.push({
        code: "STALE_POSITION",
        severity: "WARNING",
        message: `Position stale for ${trade.tradeId}.`,
      });
    }
    if (snap.status === "UNKNOWN") {
      issues.push({
        code: "POSITION_STATE_UNKNOWN",
        severity: "BLOCKED",
        message: `Position unknown for ${trade.tradeId}.`,
      });
    }
  }

  const blockedRecon = events.some((e) => {
    if (e.type !== "POSITION_RECONCILIATION_WARNING") return false;
    const status = (e.payload as { status?: string }).status;
    return status === "BLOCKED";
  });
  if (blockedRecon) {
    issues.push({
      code: "RECONCILIATION_BLOCKED",
      severity: "BLOCKED",
      message: "Critical reconciliation blocked state detected.",
    });
  }

  return { issues, orphanTrades, missingPnlTrades, stalePositionTrades };
}

export async function runEngineHealthCheck(): Promise<EngineHealthReport> {
  const events = await getEvents();
  const { issues, orphanTrades, missingPnlTrades, stalePositionTrades } =
    checkStateConsistency(events);
  const hasBlocked = issues.some((i) => i.severity === "BLOCKED");
  const status = hasBlocked ? "BLOCKED" : issues.length > 0 ? "WARNING" : "OK";
  return {
    status,
    checkedAt: new Date().toISOString(),
    issues,
    orphanTrades,
    missingPnlTrades,
    stalePositionTrades,
    blocksExecution: hasBlocked,
    message:
      status === "OK"
        ? "Engine health OK."
        : status === "WARNING"
          ? "Engine health warnings present."
          : "Engine health blocked — execution and close disabled.",
  };
}

export async function isEngineExecutionBlocked(): Promise<boolean> {
  const report = await runEngineHealthCheck();
  return report.blocksExecution;
}
