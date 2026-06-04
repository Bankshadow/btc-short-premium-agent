import type {
  AnalyzeApiResponse,
  DecisionEngineInput,
} from "@/lib/types/market";
import type { TradingDeskOutput } from "./types";
import { runCommitteeAgent } from "./committee-agent";
import { runFuturesStrategyAgent } from "./futures-agent";
import { runMarketDataAgent } from "./market-data-agent";
import { runOptionsStrategyAgent } from "./options-agent";
import { runPortfolioAgent } from "./portfolio-agent";
import { runRegimeAgent } from "./regime-agent";
import { runRiskManagerAgent } from "./risk-manager-agent";
import { runSpotStrategyAgent } from "./spot-agent";
import {
  buildMissionControl,
  buildTradingDeskContext,
  TRADING_DESK_DISCLAIMER,
  type TradingDeskContext,
} from "./shared";

const AGENT_COUNT = 8;

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
  const regime = runRegimeAgent(ctx);
  const spot = runSpotStrategyAgent(ctx);
  const futures = runFuturesStrategyAgent(ctx);
  const options = runOptionsStrategyAgent(ctx);
  const riskManager = runRiskManagerAgent(ctx);

  const { agent: committee, verdict: committeeVerdict, debate } =
    runCommitteeAgent({
      ctx,
      regime,
      marketData,
      spot,
      futures,
      options,
      riskManager,
    });

  const { agent: portfolio, milestones: portfolioMilestones } =
    runPortfolioAgent(ctx, committeeVerdict.recommendation);

  const agents = [
    marketData,
    regime.agent,
    spot,
    futures,
    options,
    riskManager,
    committee,
    portfolio,
  ];

  const missionControl = buildMissionControl(ctx, AGENT_COUNT);

  return {
    analyzedAt: response.step5_verdict.analyzedAt,
    missionControl,
    regime,
    agents,
    debate,
    riskManager,
    committee,
    committeeVerdict,
    portfolio,
    portfolioMilestones,
    portfolioAllocation: portfolioMilestones,
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
