import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import { variantShadowVerdict, hypotheticalPnl } from "./evaluate-variant";
import { evaluateExperimentOutcome } from "./evaluate-outcome";
import { generatePromotionProposal } from "./generate-promotion";
import type {
  ExperimentResult,
  RunExperimentInput,
  ShadowTradeRecord,
  StrategyExperiment,
} from "./types";

function shadowId(): string {
  return `shadow-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function runHistoricalReplay(
  experiment: StrategyExperiment,
  entries: DecisionLogEntry[],
  orders?: PaperOrder[],
): {
  experiment: StrategyExperiment;
  shadowTrades: ShadowTradeRecord[];
  result: ExperimentResult;
} {
  const candidates = entries.filter((e) => e.outcomeStatus === "RESOLVED");
  const shadowTrades: ShadowTradeRecord[] = [];

  let shadowWins = 0;
  let shadowTradesCount = 0;
  let netPnl = 0;
  let committeeTrades = 0;

  for (const entry of candidates) {
    const shadowVerdict = variantShadowVerdict(
      entry,
      experiment.variant,
      experiment.mode,
      orders,
    );
    const hypo = hypotheticalPnl(shadowVerdict, entry);
    const actual = entry.finalVerdict === "TRADE" ? entry.paperPnl : 0;
    const aligned = shadowVerdict === entry.finalVerdict;

    if (shadowVerdict === "TRADE") {
      shadowTradesCount += 1;
      netPnl += hypo ?? 0;
      if ((hypo ?? 0) > 0) shadowWins += 1;
    }
    if (entry.finalVerdict === "TRADE") committeeTrades += 1;

    shadowTrades.push({
      id: shadowId(),
      decisionLogId: entry.id,
      timestamp: entry.timestamp,
      marketRegime: entry.marketRegime,
      committeeVerdict: entry.finalVerdict,
      shadowVerdict,
      aligned,
      hypotheticalPnlPct: hypo,
      actualPnlPct: actual,
      notes:
        aligned
          ? "Shadow aligned with committee"
          : `Shadow ${shadowVerdict} vs committee ${entry.finalVerdict}`,
    });
  }

  const winRate =
    shadowTradesCount > 0
      ? Math.round((shadowWins / shadowTradesCount) * 100)
      : 0;
  const shadowAccuracyPct =
    shadowTrades.length > 0
      ? Math.round(
          (shadowTrades.filter((s) => s.aligned).length / shadowTrades.length) * 100,
        )
      : 0;
  const tradeFrequencyDelta =
    committeeTrades > 0
      ? Number(
          (((shadowTradesCount - committeeTrades) / committeeTrades) * 100).toFixed(1),
        )
      : shadowTradesCount > 0
        ? 100
        : 0;

  const result: ExperimentResult = evaluateExperimentOutcome({
    experiment,
    sampleSize: shadowTradesCount,
    winRate,
    netPnlPct: Number(netPnl.toFixed(2)),
    shadowAccuracyPct,
    tradeFrequencyDelta,
  });

  let status = experiment.status;
  if (result.passedFailure) status = "failed";
  else if (result.passedSuccess) status = "promotion_pending";
  else status = "completed";

  const promotionProposal = result.passedSuccess
    ? generatePromotionProposal(experiment, result)
    : experiment.promotionProposal;

  const updated: StrategyExperiment = {
    ...experiment,
    status,
    shadowTrades: [...experiment.shadowTrades, ...shadowTrades].slice(-50),
    result,
    promotionProposal,
    updatedAt: new Date().toISOString(),
  };

  return { experiment: updated, shadowTrades, result };
}

export function executeExperimentRun(
  experiment: StrategyExperiment,
  input: RunExperimentInput,
): StrategyExperiment {
  const { experiment: updated } = runHistoricalReplay(
    { ...experiment, status: "running" },
    input.entries,
    input.orders,
  );
  return updated;
}
