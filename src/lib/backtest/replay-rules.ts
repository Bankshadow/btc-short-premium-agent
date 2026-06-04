import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";

export interface BacktestReplayRow {
  logId: string;
  timestamp: string;
  loggedVerdict: string;
  wouldSkipNow: boolean;
  wouldTradeNow: boolean;
  delta: "same" | "stricter" | "looser";
  reasons: string[];
}

export interface BacktestReplayReport {
  sampled: number;
  wouldSkipNow: number;
  wouldTradeNow: number;
  stricterCount: number;
  rows: BacktestReplayRow[];
}

/**
 * Lightweight replay: compare logged verdict vs risk veto / operator override.
 * Full engine replay needs stored market snapshots (future MVP 8).
 */
export function replayRulesOnLogEntries(
  entries: DecisionLogEntry[],
  maxRows = 20,
): BacktestReplayReport {
  const rows: BacktestReplayRow[] = [];

  for (const entry of entries.slice(0, maxRows)) {
    if (!entry.replaySnapshot) continue;

    const reasons: string[] = [];
    const logged = entry.finalVerdict;
    const wouldSkipNow = entry.riskVeto;
    const wouldTradeNow = !entry.riskVeto && logged === "TRADE";

    if (entry.riskVeto) {
      reasons.push("Risk veto on record — would still block TRADE.");
    }
    if (entry.operatorOverride) {
      reasons.push(
        `Operator disagreed (expected ${entry.operatorOverride.disagreeWithVerdict}).`,
      );
    }

    let delta: BacktestReplayRow["delta"] = "same";
    if (wouldSkipNow && logged === "TRADE") delta = "stricter";
    if (!wouldSkipNow && logged === "SKIP") delta = "looser";

    rows.push({
      logId: entry.id,
      timestamp: entry.timestamp,
      loggedVerdict: logged,
      wouldSkipNow,
      wouldTradeNow,
      delta,
      reasons: reasons.slice(0, 2),
    });
  }

  return {
    sampled: rows.length,
    wouldSkipNow: rows.filter((r) => r.wouldSkipNow).length,
    wouldTradeNow: rows.filter((r) => r.wouldTradeNow).length,
    stricterCount: rows.filter((r) => r.delta === "stricter").length,
    rows,
  };
}
