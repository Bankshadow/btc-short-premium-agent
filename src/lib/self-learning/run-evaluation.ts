import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import { buildLearningEvaluationReport } from "./build-learning-report";
import { evaluateClosedTrade } from "./evaluate-entry";
import { appendEvaluationResult, loadEvaluationResults } from "./evaluation-store";
import type {
  LearningEvaluationReport,
  PostTradeEvaluationSource,
  TradeEvaluationResult,
} from "./types";

export function runPostTradeEvaluation(input: {
  entry: DecisionLogEntry;
  source: PostTradeEvaluationSource;
  liveTradeId?: string;
  pnlOverride?: number;
  persist?: boolean;
}): TradeEvaluationResult | null {
  const result = evaluateClosedTrade(input);
  if (!result) return null;
  if (input.persist !== false && typeof window !== "undefined") {
    appendEvaluationResult(result);
  }
  return result;
}

export function runEvaluationFromLivePilotClose(input: {
  journalEntry: LiveTradeJournalEntry;
  decisionEntry?: DecisionLogEntry | null;
}): TradeEvaluationResult | null {
  const { journalEntry, decisionEntry } = input;
  if (!decisionEntry || decisionEntry.outcomeStatus !== "RESOLVED") {
    if (!decisionEntry) return null;
    const enriched: DecisionLogEntry = {
      ...decisionEntry,
      outcomeStatus: "RESOLVED",
      paperPnl: journalEntry.realizedPnl ?? 0,
      resolution: {
        btcPriceAfter: journalEntry.exit?.price ?? 0,
        tradeWouldWin:
          (journalEntry.realizedPnl ?? 0) > 0
            ? true
            : (journalEntry.realizedPnl ?? 0) < 0
              ? false
              : null,
        notes: "Live pilot close evaluation",
        resolvedAt: journalEntry.closedAt ?? new Date().toISOString(),
      },
    };
    return runPostTradeEvaluation({
      entry: enriched,
      source: "live_pilot_close",
      liveTradeId: journalEntry.liveTradeId,
      pnlOverride: journalEntry.realizedPnl ?? 0,
    });
  }

  return runPostTradeEvaluation({
    entry: decisionEntry,
    source: "live_pilot_close",
    liveTradeId: journalEntry.liveTradeId,
    pnlOverride: journalEntry.realizedPnl ?? decisionEntry.paperPnl ?? 0,
  });
}

export function runBatchEvaluation(
  entries: DecisionLogEntry[],
  persist = false,
): TradeEvaluationResult[] {
  const results: TradeEvaluationResult[] = [];
  for (const entry of entries.filter((e) => e.outcomeStatus === "RESOLVED")) {
    const result = runPostTradeEvaluation({
      entry,
      source: "manual_resolve",
      persist,
    });
    if (result) results.push(result);
  }
  return results;
}

export function runLearningReport(
  entries: DecisionLogEntry[],
  storedResults?: TradeEvaluationResult[],
): LearningEvaluationReport {
  const results = storedResults ?? loadEvaluationResults();
  return buildLearningEvaluationReport({ entries, storedResults: results });
}
