import type {
  AnalyzeApiResponse,
  DecisionEngineInput,
  SpotQuote,
} from "@/lib/types/market";
import type { DeskMemoryClientPayload } from "@/lib/memory/types";
import { runDeskMemoryAgent } from "@/lib/memory/memory-agent";
import { prepareDeskMemoryGraph } from "@/lib/memory-graph/prepare-desk-memory";
import { runResearchLayer } from "@/lib/research/run-research-layer";
import type { TradingDeskOutput } from "./types";
import { runBearThesisAgent } from "./bear-thesis-agent";
import { runBullThesisAgent } from "./bull-thesis-agent";
import { runCommitteeAgent } from "./committee-agent";
import { runFuturesStrategyAgent } from "./futures-agent";
import {
  runLongChartAgent,
  runMediumChartAgent,
  runShortChartAgent,
} from "./timeframe-chart-agents";
import { runOptionsStrategyAgent } from "./options-agent";
import { runRiskManagerAgent } from "./risk-manager-agent";
import { runSpotStrategyAgent } from "./spot-agent";
import {
  buildTradingDeskContext,
  resolveMarketRegime,
  TRADING_DESK_DISCLAIMER,
  type TradingDeskContext,
} from "./shared";
import { applyRegistryToStrategyAgents } from "@/lib/strategy-registry/strategy-registry-gates";
import type { StrategyRegistryAnalyzePayload } from "@/lib/strategy-registry/strategy-registry-types";
import { applyGovernanceToVerdict } from "@/lib/governance/apply-governance-verdict";
import { applyGovernanceRuntime } from "@/lib/governance/governance-runtime";
import {
  evaluateHardRuleLocks,
  mergeHardRuleResults,
} from "@/lib/governance/hard-rule-lock";
import type { GovernanceAnalyzePayload } from "@/lib/governance/governance-types";
import { applyReliabilityLayerToAnalyzeResponse } from "@/lib/data-trust/apply-reliability-layer";
import { applyPreMortemToAnalyzeResponse } from "@/lib/mortem/apply-mortem-layer";
import { applyAdaptiveWeightingToAnalyzeResponse } from "@/lib/adaptive-agent-weighting/apply-adaptive-weighting";
import type { AdaptiveWeightingAnalyzePayload } from "@/lib/adaptive-agent-weighting/types";
import { detectMarketRegime } from "@/lib/market-regime-brain/detect-regime";
import { applyRegimeBrainToStrategyAgents } from "@/lib/market-regime-brain/apply-regime-gates";
import {
  applyAdvisorySignalsToDesk,
  buildStrategySignalsNotice,
} from "@/lib/strategy-signals/apply-advisory-signals";
import type { AdvisoryStrategySignal } from "@/lib/strategy-signals/types";
import type { SecondBrainCycleSnapshot } from "@/lib/second-brain/types";
import { SECOND_BRAIN_SAFETY_NOTICE } from "@/lib/second-brain/types";

export function runTradingDesk(
  input: DecisionEngineInput,
  response: AnalyzeApiResponse,
  memoryPayload?: DeskMemoryClientPayload,
  ethQuote?: SpotQuote | null,
  strategyRegistry?: StrategyRegistryAnalyzePayload | null,
  governance?: GovernanceAnalyzePayload | null,
  advisoryStrategySignals: AdvisoryStrategySignal[] = [],
  secondBrain?: SecondBrainCycleSnapshot | null,
): TradingDeskOutput {
  const serverRules = evaluateHardRuleLocks({ data: response });
  const hardRules = governance?.hardRules
    ? mergeHardRuleResults(governance.hardRules, serverRules)
    : serverRules;

  const effectiveGovernance: GovernanceAnalyzePayload = {
    safeMode: governance?.safeMode ?? false,
    disableAggressiveMode: governance?.disableAggressiveMode ?? false,
    pauseAnalysis: governance?.pauseAnalysis ?? false,
    hardRules,
  };

  applyGovernanceRuntime({
    safeMode: effectiveGovernance.safeMode,
    disableAggressiveMode: effectiveGovernance.disableAggressiveMode,
    hardRules: effectiveGovernance.hardRules,
  });

  const baseCtx = buildTradingDeskContext(input, response);
  const legacyRegime = resolveMarketRegime(baseCtx);
  const secondBrainBullets = memoryPayload?.secondBrainBullets ?? [];
  const memoryGraphPrep = prepareDeskMemoryGraph(
    memoryPayload,
    legacyRegime,
    input.deskRiskProfile,
  );
  if (secondBrainBullets.length > 0) {
    memoryGraphPrep.bullets = [
      ...new Set([...secondBrainBullets, ...memoryGraphPrep.bullets]),
    ].slice(0, 10);
  }

  const regimeBrain = detectMarketRegime({
    input,
    response,
    ethQuote: ethQuote ?? null,
    relevantMemory: memoryGraphPrep.relevant,
  });
  const marketRegime = regimeBrain.deskLabel;

  const ctx: TradingDeskContext = {
    ...baseCtx,
    deskMemoryPayload: memoryPayload,
    deskMemoryRegime: marketRegime,
    deskMemoryGraphSnapshot: memoryGraphPrep.snapshot,
    deskMemoryRelevant: memoryGraphPrep.relevant,
    deskMemoryBullets: memoryGraphPrep.bullets,
    ethQuote: ethQuote ?? null,
    regimeBrain,
  };

  let research = runResearchLayer(ctx, { ethQuote });
  ctx.researchBullets = research.summaryBullets;

  const deskMemory = runDeskMemoryAgent(ctx, memoryPayload);
  ctx.deskMemoryBullets = deskMemory.bullets;
  ctx.deskMemoryRelevant = deskMemory.relevantMemory;

  const bullThesis = runBullThesisAgent(ctx);
  const bearThesis = runBearThesisAgent(ctx);
  const spotRaw = runSpotStrategyAgent(ctx);
  const futuresRaw = runFuturesStrategyAgent(ctx);
  const optionsRaw = runOptionsStrategyAgent(ctx);
  const shortChartRaw = runShortChartAgent(ctx);
  const mediumChartRaw = runMediumChartAgent(ctx);
  const longChartRaw = runLongChartAgent(ctx);
  const registryGated = applyRegistryToStrategyAgents({
    spot: spotRaw,
    futures: futuresRaw,
    options: optionsRaw,
    payload: strategyRegistry,
  });
  const { spot, futures, options } = applyRegimeBrainToStrategyAgents({
    ...registryGated,
    brain: regimeBrain,
  });
  let riskManager = runRiskManagerAgent(ctx, bullThesis, bearThesis);

  let { verdict: committeeRaw, debate } = runCommitteeAgent({
    ctx,
    spot,
    futures,
    options,
    shortChart: shortChartRaw,
    mediumChart: mediumChartRaw,
    longChart: longChartRaw,
    bull: bullThesis,
    bear: bearThesis,
    riskManager,
    deskMemory,
    research,
  });
  let committee = applyGovernanceToVerdict(committeeRaw, effectiveGovernance);

  const advisoryApplied = applyAdvisorySignalsToDesk({
    signals: advisoryStrategySignals,
    research,
    spot,
    futures,
    options,
    riskManager,
    committee,
  });
  research = advisoryApplied.research;
  const spotAdvised = advisoryApplied.spot;
  const futuresAdvised = advisoryApplied.futures;
  const optionsAdvised = advisoryApplied.options;
  riskManager = advisoryApplied.riskManager;
  committee = advisoryApplied.committee;

  const agents = [
    ...research.agents,
    deskMemory.agent,
    bullThesis,
    bearThesis,
    spotAdvised,
    futuresAdvised,
    optionsAdvised,
    shortChartRaw,
    mediumChartRaw,
    longChartRaw,
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
    regimeBrain,
    debate,
    disclaimer: TRADING_DESK_DISCLAIMER,
    strategySignals: advisoryStrategySignals,
    strategySignalsNotice: buildStrategySignalsNotice(advisoryStrategySignals.length),
    secondBrain: secondBrain ?? undefined,
    secondBrainNotice:
      secondBrain && secondBrain.relevantLessons.length > 0
        ? `${secondBrain.summaryHeadline} · ${SECOND_BRAIN_SAFETY_NOTICE}`
        : SECOND_BRAIN_SAFETY_NOTICE,
  };
}

export function attachTradingDesk(
  input: DecisionEngineInput,
  response: AnalyzeApiResponse,
  memoryPayload?: DeskMemoryClientPayload,
  ethQuote?: SpotQuote | null,
  strategyRegistry?: StrategyRegistryAnalyzePayload | null,
  governance?: GovernanceAnalyzePayload | null,
  adaptiveWeighting?: AdaptiveWeightingAnalyzePayload | null,
  advisoryStrategySignals: AdvisoryStrategySignal[] = [],
  secondBrain?: SecondBrainCycleSnapshot | null,
): AnalyzeApiResponse {
  const withDesk: AnalyzeApiResponse = {
    ...response,
    tradingDesk: runTradingDesk(
      input,
      response,
      memoryPayload,
      ethQuote,
      strategyRegistry,
      governance,
      advisoryStrategySignals,
      secondBrain,
    ),
  };
  const reliable = applyReliabilityLayerToAnalyzeResponse(
    input,
    withDesk,
    ethQuote,
    memoryPayload,
  );
  const withMortem = applyPreMortemToAnalyzeResponse(
    input,
    reliable,
    `pending-${Date.now()}`,
  );
  return applyAdaptiveWeightingToAnalyzeResponse(
    input,
    withMortem,
    adaptiveWeighting,
    governance,
    strategyRegistry,
    { isLiveContext: false },
  );
}

export type { TradingDeskContext };
