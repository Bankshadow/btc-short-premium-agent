import type {
  AnalyzeApiResponse,
  DecisionEngineInput,
} from "@/lib/types/market";
import type { TradingDeskOutput } from "./types";
import { runBearThesisAgent } from "./bear-thesis-agent";
import { runBullThesisAgent } from "./bull-thesis-agent";
import { runCommitteeAgent } from "./committee-agent";
import { runFuturesStrategyAgent } from "./futures-agent";
import { runOptionsStrategyAgent } from "./options-agent";
import { runRiskManagerAgent } from "./risk-manager-agent";
import { runSpotStrategyAgent } from "./spot-agent";
import {
  buildTradingDeskContext,
  resolveMarketRegime,
  TRADING_DESK_DISCLAIMER,
  type TradingDeskContext,
} from "./shared";

export function runTradingDesk(
  input: DecisionEngineInput,
  response: AnalyzeApiResponse,
): TradingDeskOutput {
  const ctx = buildTradingDeskContext(input, response);

  const bullThesis = runBullThesisAgent(ctx);
  const bearThesis = runBearThesisAgent(ctx);
  const spot = runSpotStrategyAgent(ctx);
  const futures = runFuturesStrategyAgent(ctx);
  const options = runOptionsStrategyAgent(ctx);
  const riskManager = runRiskManagerAgent(ctx, bullThesis, bearThesis);

  const { verdict: committee, debate } = runCommitteeAgent({
    ctx,
    spot,
    futures,
    options,
    bull: bullThesis,
    bear: bearThesis,
    riskManager,
  });

  const agents = [
    bullThesis,
    bearThesis,
    spot,
    futures,
    options,
    riskManager,
  ];

  return {
    analyzedAt: response.step5_verdict.analyzedAt,
    marketRegime: resolveMarketRegime(ctx),
    agents,
    bullThesis,
    bearThesis,
    riskManager,
    committee,
    debate,
    disclaimer: TRADING_DESK_DISCLAIMER,
  };
}

export function attachTradingDesk(
  input: DecisionEngineInput,
  response: AnalyzeApiResponse,
): AnalyzeApiResponse {
  return {
    ...response,
    tradingDesk: runTradingDesk(input, response),
  };
}

export type { TradingDeskContext };
