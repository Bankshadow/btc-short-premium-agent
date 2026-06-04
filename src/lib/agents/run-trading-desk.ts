import type {
  AnalyzeApiResponse,
  DecisionEngineInput,
  SpotQuote,
} from "@/lib/types/market";
import type { DeskMemoryClientPayload } from "@/lib/memory/types";
import { runDeskMemoryAgent } from "@/lib/memory/memory-agent";
import { runResearchLayer } from "@/lib/research/run-research-layer";
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
  memoryPayload?: DeskMemoryClientPayload,
  ethQuote?: SpotQuote | null,
): TradingDeskOutput {
  const baseCtx = buildTradingDeskContext(input, response);
  const marketRegime = resolveMarketRegime(baseCtx);

  const ctx: TradingDeskContext = {
    ...baseCtx,
    deskMemoryPayload: memoryPayload,
    deskMemoryRegime: marketRegime,
    ethQuote: ethQuote ?? null,
  };

  const research = runResearchLayer(ctx, { ethQuote });
  ctx.researchBullets = research.summaryBullets;

  const deskMemory = runDeskMemoryAgent(ctx, memoryPayload);
  ctx.deskMemoryBullets = deskMemory.bullets;

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
    deskMemory,
    research,
  });

  const agents = [
    ...research.agents,
    deskMemory.agent,
    bullThesis,
    bearThesis,
    spot,
    futures,
    options,
    riskManager,
  ];

  return {
    analyzedAt: response.step5_verdict.analyzedAt,
    marketRegime,
    research,
    deskMemory,
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
  memoryPayload?: DeskMemoryClientPayload,
  ethQuote?: SpotQuote | null,
): AnalyzeApiResponse {
  return {
    ...response,
    tradingDesk: runTradingDesk(input, response, memoryPayload, ethQuote),
  };
}

export type { TradingDeskContext };
