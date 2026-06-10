import type { AnalysisVerdict, VerdictPayload } from "@/lib/analysis/analysis-types";
import type { JournalEvent } from "@/lib/journal/journal-types";
import {
  DEFAULT_START_CAPITAL,
  DEFAULT_TARGET_CAPITAL,
  type MissionSnapshot,
} from "./mission-types";

function latestVerdictEvent(events: JournalEvent[]): JournalEvent | null {
  return (
    [...events]
      .filter((e) => e.type === "VERDICT_CREATED")
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0] ?? null
  );
}

function latestAnalysisStarted(events: JournalEvent[]): JournalEvent | null {
  return (
    [...events]
      .filter((e) => e.type === "ANALYSIS_STARTED")
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0] ?? null
  );
}

function countClosedTrades(events: JournalEvent[]): number {
  return events.filter((e) => e.type === "POSITION_CLOSED").length;
}

function countWins(events: JournalEvent[]): number {
  return events.filter(
    (e) =>
      e.type === "PNL_REALIZED" &&
      (e.payload as { result?: string }).result === "WIN",
  ).length;
}

function countBreakeven(events: JournalEvent[]): number {
  return events.filter(
    (e) =>
      e.type === "PNL_REALIZED" &&
      (e.payload as { result?: string }).result === "BREAKEVEN",
  ).length;
}

function countLosses(events: JournalEvent[]): number {
  return events.filter(
    (e) =>
      e.type === "PNL_REALIZED" &&
      (e.payload as { result?: string }).result === "LOSS",
  ).length;
}

function sumNetPnl(events: JournalEvent[]): number {
  return events
    .filter((e) => e.type === "PNL_REALIZED")
    .reduce((sum, e) => sum + Number((e.payload as { netPnl?: number }).netPnl ?? 0), 0);
}

function countOpenPositions(events: JournalEvent[]): number {
  const opened = new Set(
    events
      .filter((e) => e.type === "POSITION_OPENED" || e.type === "ORDER_EXECUTED")
      .map((e) => e.tradeId)
      .filter(Boolean) as string[],
  );
  const closed = new Set(
    events
      .filter((e) => e.type === "POSITION_CLOSED")
      .map((e) => e.tradeId)
      .filter(Boolean) as string[],
  );
  let open = 0;
  for (const id of opened) {
    if (!closed.has(id)) open += 1;
  }
  return open;
}

export function buildMissionSnapshot(events: JournalEvent[]): MissionSnapshot {
  const started = latestAnalysisStarted(events);
  const verdictEvt = latestVerdictEvent(events);
  const verdictPayload = verdictEvt?.payload as VerdictPayload | undefined;

  const netPnl = sumNetPnl(events);
  const currentEquity = DEFAULT_START_CAPITAL + netPnl;
  const progressPct = Math.min(
    100,
    Math.max(
      0,
      ((currentEquity - DEFAULT_START_CAPITAL) /
        (DEFAULT_TARGET_CAPITAL - DEFAULT_START_CAPITAL)) *
        100,
    ),
  );

  return {
    generatedAt: new Date().toISOString(),
    startCapital: DEFAULT_START_CAPITAL,
    targetCapital: DEFAULT_TARGET_CAPITAL,
    currentEquity: Number(currentEquity.toFixed(2)),
    progressPct: Number(progressPct.toFixed(1)),
    totalTrades: countClosedTrades(events),
    win: countWins(events),
    loss: countLosses(events),
    breakeven: countBreakeven(events),
    netPnl: Number(netPnl.toFixed(4)),
    openPositions: countOpenPositions(events),
    latestRunId: started?.runId ?? verdictEvt?.runId ?? null,
    latestDecisionLogId: started?.decisionLogId ?? verdictEvt?.decisionLogId ?? null,
    latestVerdict: (verdictPayload?.verdict as AnalysisVerdict | undefined) ?? null,
    latestConfidence: verdictPayload?.confidence ?? null,
    latestVerdictReasons: verdictPayload?.reasons ?? [],
    liveLocked: true,
  };
}
