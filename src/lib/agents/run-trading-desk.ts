import type {
  AnalyzeApiResponse,
  DecisionEngineInput,
} from "@/lib/types/market";
import type { TradingDeskOutput } from "@/lib/types/agent";
import { runCommitteeAgent } from "./committee-agent";
import { runFuturesStrategyAgent } from "./futures-agent";
import { runMarketDataAgent } from "./market-data-agent";
import { runOptionsStrategyAgent } from "./options-agent";
import { runPortfolioAllocatorAgent } from "./portfolio-allocator-agent";
import { runRiskManagerAgent } from "./risk-manager-agent";
import { runSpotStrategyAgent } from "./spot-agent";
import {
  buildTradingDeskContext,
  TRADING_DESK_DISCLAIMER,
  type TradingDeskContext,
} from "./shared";

export function runTradingDesk(
  input: DecisionEngineInput,
  response: AnalyzeApiResponse,
  portfolioCapitalUsd?: number,
): TradingDeskOutput {
  const ctx = buildTradingDeskContext(
    input,
    response,
    portfolioCapitalUsd,
  );

  const marketData = runMarketDataAgent(ctx);
  const spot = runSpotStrategyAgent(ctx);
  const futures = runFuturesStrategyAgent(ctx);
  const options = runOptionsStrategyAgent(ctx);
  const riskManager = runRiskManagerAgent(ctx);

  const { agent: committee, verdict: committeeVerdict, debate } =
    runCommitteeAgent({
      ctx,
      marketData,
      spot,
      futures,
      options,
      riskManager,
    });

  const { agent: portfolio, allocation: portfolioAllocation } =
    runPortfolioAllocatorAgent(ctx, committeeVerdict.recommendation);

  const agents = [
    marketData,
    spot,
    futures,
    options,
    riskManager,
    committee,
    portfolio,
  ];

  return {
    analyzedAt: response.step5_verdict.analyzedAt,
    agents,
    debate,
    riskManager,
    committee,
    committeeVerdict,
    portfolio,
    portfolioAllocation,
    disclaimer: TRADING_DESK_DISCLAIMER,
  };
}

export function attachTradingDesk(
  input: DecisionEngineInput,
  response: AnalyzeApiResponse,
  portfolioCapitalUsd?: number,
): AnalyzeApiResponse {
  return {
    ...response,
    tradingDesk: runTradingDesk(input, response, portfolioCapitalUsd),
  };
}

export type { TradingDeskContext };
