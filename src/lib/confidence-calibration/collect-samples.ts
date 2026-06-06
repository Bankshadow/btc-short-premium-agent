import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { TradeEvaluationResult } from "@/lib/self-learning/types";
import type { ConfidenceCalibrationSample } from "./types";

function resolveConfidenceBeforeTrade(
  entry: DecisionLogEntry | undefined,
  evaluation: TradeEvaluationResult,
): number {
  if (entry?.playbookConfidence != null) {
    return clamp(entry.playbookConfidence);
  }
  if (entry?.orderTicket?.confidence != null) {
    return clamp(entry.orderTicket.confidence);
  }
  if (entry?.committeeTradeScore != null) {
    return clamp(entry.committeeTradeScore);
  }
  if (evaluation.finalVerdict === "TRADE") return 72;
  if (evaluation.finalVerdict === "WAIT") return 55;
  return 45;
}

function clamp(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

function resultFromEvaluation(evaluation: TradeEvaluationResult): ConfidenceCalibrationSample["result"] {
  if (evaluation.tradeWouldWin === true || evaluation.pnlPct > 0.05) return "WIN";
  if (evaluation.tradeWouldWin === false || evaluation.pnlPct < -0.05) return "LOSS";
  if (Math.abs(evaluation.pnlPct) <= 0.05) return "BREAKEVEN";
  return "UNKNOWN";
}

export function collectCalibrationSamples(input: {
  evaluations: TradeEvaluationResult[];
  entries: DecisionLogEntry[];
}): ConfidenceCalibrationSample[] {
  const entryMap = new Map(input.entries.map((e) => [e.id, e]));
  const samples: ConfidenceCalibrationSample[] = [];

  for (const evaluation of input.evaluations) {
    if (evaluation.tradeWouldWin === null && Math.abs(evaluation.pnlPct) < 0.001) {
      continue;
    }
    const entry = entryMap.get(evaluation.decisionLogId);
    const confidenceBeforeTrade = resolveConfidenceBeforeTrade(entry, evaluation);
    const actualWin =
      evaluation.tradeWouldWin === true ||
      (evaluation.tradeWouldWin === null && evaluation.pnlPct > 0);

    samples.push({
      sampleId: `${evaluation.decisionLogId}:${evaluation.source}`,
      decisionLogId: evaluation.decisionLogId,
      confidenceBeforeTrade,
      actualWin,
      pnlPct: evaluation.pnlPct,
      result: resultFromEvaluation(evaluation),
      source: evaluation.source,
      evaluatedAt: evaluation.generatedAt,
    });
  }

  return samples;
}
