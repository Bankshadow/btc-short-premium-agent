import type {
  BacktestCompareResult,
  BacktestScenario,
  StrategyVersionComparison,
} from "./types";
import { HISTORICAL_BACKTEST_SAFETY_NOTICE } from "./types";
import { runHistoricalBacktest } from "./run-backtest";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";

function buildComparison(
  baselineVersion: string,
  proposedVersion: string,
  baseline: ReturnType<typeof runHistoricalBacktest>,
  proposed: ReturnType<typeof runHistoricalBacktest>,
): StrategyVersionComparison {
  const b = baseline.metrics;
  const p = proposed.metrics;

  let recommendation = "No material difference — keep current rules.";
  if (p.totalReturnPct > b.totalReturnPct + 2 && p.falseTradeCount <= b.falseTradeCount) {
    recommendation =
      "Proposed rules improve return with stable false-TRADE rate — review for human approval.";
  } else if (p.falseTradeCount < b.falseTradeCount - 1) {
    recommendation =
      "Proposed rules reduce false TRADEs — consider tightening for adaptation review.";
  } else if (p.totalReturnPct < b.totalReturnPct - 3) {
    recommendation =
      "Proposed rules underperform baseline — do not auto-apply.";
  }

  return {
    baselineVersion,
    proposedVersion,
    baselineMetrics: b,
    proposedMetrics: p,
    deltaReturnPct: Number((p.totalReturnPct - b.totalReturnPct).toFixed(2)),
    deltaWinRate: p.winRate - b.winRate,
    deltaTradeFrequency: p.tradeFrequency - b.tradeFrequency,
    deltaFalseTrade: p.falseTradeCount - b.falseTradeCount,
    deltaFalseSkip: p.falseSkipCount - b.falseSkipCount,
    recommendation,
  };
}

export function compareBacktestScenarios(input: {
  entries: DecisionLogEntry[];
  orders?: PaperOrder[];
  baseline: BacktestScenario;
  proposed: BacktestScenario;
}): BacktestCompareResult {
  const baseline = runHistoricalBacktest({
    scenario: input.baseline,
    entries: input.entries,
    orders: input.orders,
  });
  const proposed = runHistoricalBacktest({
    scenario: input.proposed,
    entries: input.entries,
    orders: input.orders,
  });

  return {
    generatedAt: new Date().toISOString(),
    comparison: buildComparison(
      input.baseline.versionTag,
      input.proposed.versionTag,
      baseline,
      proposed,
    ),
    baseline,
    proposed,
    safetyNotice: HISTORICAL_BACKTEST_SAFETY_NOTICE,
  };
}
