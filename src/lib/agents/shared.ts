import type {
  AnalyzeApiResponse,
  DataSourceError,
  DecisionEngineInput,
  OptionCandidate,
  TradeRecommendation,
} from "@/lib/types/market";
import type {
  AgentMarketView,
  AgentOutput,
  AgentRecommendation,
  ProposedAction,
} from "@/lib/types/agent";
import { tradeRecToAgent } from "@/lib/types/agent";

export const TRADING_DESK_DISCLAIMER =
  "Multi-Agent AI Trading Desk — analysis only. No auto execution. Co-pilot, not auto-pilot.";

export const DEFAULT_PORTFOLIO_CAPITAL_USD = 1000;
export const PORTFOLIO_GOAL_USD = 20_000;
export const PORTFOLIO_STAGES_USD = [1000, 2000, 4000, 8000, 16_000, 20_000] as const;

export const MAX_LOSS_PER_TRADE_PCT = 2;
export const MAX_DAILY_LOSS_PCT = 5;

export interface TradingDeskContext {
  input: DecisionEngineInput;
  response: AnalyzeApiResponse;
  sourceErrors: DataSourceError[];
  portfolioCapitalUsd: number;
}

export function buildTradingDeskContext(
  input: DecisionEngineInput,
  response: AnalyzeApiResponse,
  portfolioCapitalUsd = DEFAULT_PORTFOLIO_CAPITAL_USD,
): TradingDeskContext {
  return {
    input,
    response,
    sourceErrors: response.sourceErrors ?? response.dataSourceIssues ?? [],
    portfolioCapitalUsd,
  };
}

export function selectBestOptionCandidate(
  candidates: OptionCandidate[],
): OptionCandidate | undefined {
  if (candidates.length === 0) return undefined;
  return [...candidates].sort(
    (a, b) =>
      Math.abs(Math.abs(a.delta) - 0.14) - Math.abs(Math.abs(b.delta) - 0.14),
  )[0];
}

export function trendToMarketView(
  trend: "bullish" | "bearish" | "neutral",
): AgentMarketView {
  return trend;
}

export function resolveMixedView(
  views: AgentMarketView[],
): AgentMarketView {
  const unique = new Set(views.filter((v) => v !== "mixed"));
  if (unique.size === 0) return "neutral";
  if (unique.size === 1) return [...unique][0];
  return "mixed";
}

export function emptyAction(notes: string): ProposedAction {
  return {
    instrument: "none",
    side: "none",
    sizePct: 0,
    notes,
  };
}

export function buildAgentOutput(
  partial: Omit<AgentOutput, "proposedAction"> & { proposedAction?: ProposedAction },
): AgentOutput {
  return {
    proposedAction: emptyAction("No execution — analysis only."),
    ...partial,
  };
}

export function fromEngineRecommendation(
  rec: TradeRecommendation,
  confidence: number,
): { recommendation: AgentRecommendation; confidence: number } {
  return {
    recommendation: tradeRecToAgent(rec),
    confidence,
  };
}

export function majorityRecommendation(
  recs: AgentRecommendation[],
): AgentRecommendation {
  const counts = { TRADE: 0, SKIP: 0, WAIT: 0 };
  for (const r of recs) counts[r] += 1;
  if (counts.SKIP >= counts.TRADE && counts.SKIP >= counts.WAIT) return "SKIP";
  if (counts.TRADE > counts.SKIP && counts.TRADE > counts.WAIT) return "TRADE";
  if (counts.WAIT > counts.TRADE) return "WAIT";
  return "SKIP";
}

export function getMissingDataLabels(ctx: TradingDeskContext): string[] {
  const missing = ctx.response.step5_verdict.missingData ?? [];
  if (missing.length > 0) return missing;

  const labels: string[] = [];
  const market = ctx.input.market;
  if (market.spotPrice <= 0) labels.push("BTC spot price");
  if (market.hv30 <= 0) labels.push("HV30");
  if (market.iv <= 0) labels.push("IV");
  if (market.ivHvRatio <= 0) labels.push("IV/HV ratio");
  if (ctx.input.optionCandidates.length === 0) labels.push("option chain");
  if (ctx.input.liquidation.liquidation24h == null) {
    labels.push("liquidation 24h");
  }
  return labels;
}
