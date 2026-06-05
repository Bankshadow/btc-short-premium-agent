import type { ExperimentResult, StrategyExperiment } from "./types";

export function evaluateExperimentOutcome(input: {
  experiment: StrategyExperiment;
  sampleSize: number;
  winRate: number;
  netPnlPct: number;
  shadowAccuracyPct: number;
  tradeFrequencyDelta: number;
}): ExperimentResult {
  const { experiment, sampleSize, winRate, netPnlPct, shadowAccuracyPct, tradeFrequencyDelta } =
    input;
  const criteria = experiment.variant.successCriteria;
  const fail = experiment.variant.failureCriteria;

  const minWin = criteria.minWinRate ?? 50;
  const minSample = criteria.minSampleSize ?? 3;
  const minPnl = criteria.minNetPnlPct ?? 0;

  const passedSuccess =
    sampleSize >= minSample &&
    winRate >= minWin &&
    netPnlPct >= minPnl &&
    shadowAccuracyPct >= 40;

  const passedFailure =
    sampleSize >= (fail.minSampleSize ?? 2) &&
    (winRate < 35 || netPnlPct < -2);

  let summary: string;
  if (passedSuccess) {
    summary = `Success criteria met — win ${winRate}%, net ${netPnlPct}%, n=${sampleSize}.`;
  } else if (passedFailure) {
    summary = `Failure criteria met — win ${winRate}%, net ${netPnlPct}%. Hypothesis rejected.`;
  } else {
    summary = `Inconclusive — win ${winRate}%, net ${netPnlPct}%, n=${sampleSize}. Need more shadow samples.`;
  }

  return {
    completedAt: new Date().toISOString(),
    sampleSize,
    winRate,
    netPnlPct,
    shadowAccuracyPct,
    tradeFrequencyDelta,
    passedSuccess,
    passedFailure,
    summary,
  };
}
