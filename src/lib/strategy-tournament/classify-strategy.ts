import type { TournamentContestantMeta, TournamentClassification, TournamentRankingMetrics } from "./types";
import type { QuantBacktestMetrics } from "@/lib/quant-backtest/types";

export function classifyTournamentStrategy(input: {
  metrics: QuantBacktestMetrics;
  ranking: TournamentRankingMetrics;
  meta: TournamentContestantMeta;
  rank: number;
  barsLoaded: number;
  totalContestants: number;
}): {
  classification: TournamentClassification;
  summary: string;
  rejectionReasons: string[];
} {
  const { metrics, ranking, meta, rank, barsLoaded, totalContestants } = input;
  const reasons: string[] = [];

  if (barsLoaded < 60) {
    return {
      classification: "NEEDS_MORE_DATA",
      summary: `${meta.strategyName} — extend history window before judging.`,
      rejectionReasons: ["Fewer than 60 bars in tournament dataset."],
    };
  }

  if (metrics.tradeCount < 5) {
    return {
      classification: "NEEDS_MORE_DATA",
      summary: `${meta.strategyName} — only ${metrics.tradeCount} trades; widen date range.`,
      rejectionReasons: [`Insufficient trades (${metrics.tradeCount} < 5).`],
    };
  }

  const topTier = rank === 1 && ranking.compositeScore >= 58;
  const strongEdge =
    metrics.totalReturnPct > 0 &&
    metrics.profitFactor >= 1.15 &&
    metrics.maxDrawdownPct <= 15 &&
    metrics.winRate >= 42;

  if (topTier && strongEdge && meta.suggestedRole !== "FILTER") {
    return {
      classification: "CANDIDATE_TESTNET",
      summary: `${meta.strategyName} ranks #${rank}/${totalContestants} — candidate for paper/testnet review (human approval required).`,
      rejectionReasons: [],
    };
  }

  if (
    meta.suggestedRole === "FILTER" ||
    meta.suggestedRole === "EXIT" ||
    (metrics.totalReturnPct > 0 && metrics.profitFactor >= 1 && ranking.compositeScore >= 45)
  ) {
    if (metrics.totalReturnPct <= 0) {
      reasons.push(`Net return ${metrics.totalReturnPct}% after friction.`);
    }
    return {
      classification: "FILTER_ONLY",
      summary: `${meta.strategyName} — use as desk filter/overlay, not standalone autopilot.`,
      rejectionReasons: reasons.length
        ? reasons
        : ["Edge too thin for direct testnet entry; better as confluence filter."],
    };
  }

  if (metrics.totalReturnPct <= 0) {
    reasons.push(`Negative net return ${metrics.totalReturnPct}%.`);
  }
  if (metrics.profitFactor < 1) {
    reasons.push(`Profit factor ${metrics.profitFactor} below 1.`);
  }
  if (metrics.maxDrawdownPct > 18) {
    reasons.push(`Max drawdown ${metrics.maxDrawdownPct}% too high.`);
  }
  if (ranking.compositeScore < 35) {
    reasons.push(`Composite score ${ranking.compositeScore} below tournament floor.`);
  }

  return {
    classification: "REJECT",
    summary: `${meta.strategyName} rejected for paper/testnet on this dataset.`,
    rejectionReasons: reasons.length
      ? reasons
      : ["Underperformed peers after fees and slippage."],
  };
}
