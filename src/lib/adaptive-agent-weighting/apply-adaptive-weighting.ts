import type { AnalyzeApiResponse, DecisionEngineInput } from "@/lib/types/market";
import type { StrategyRegistryAnalyzePayload } from "@/lib/strategy-registry/strategy-registry-types";
import type { GovernanceAnalyzePayload } from "@/lib/governance/governance-types";
import { runAdaptiveWeighting } from "./run-adaptive-weighting";
import type { AdaptiveWeightingAnalyzePayload } from "./types";

function resolveTargetStrategy(
  registry?: StrategyRegistryAnalyzePayload | null,
): string {
  const first = registry?.strategies?.[0];
  if (first?.id) return first.id;
  return "options_short_premium";
}

export function applyAdaptiveWeightingToAnalyzeResponse(
  engineInput: DecisionEngineInput,
  response: AnalyzeApiResponse,
  payload?: AdaptiveWeightingAnalyzePayload | null,
  governance?: GovernanceAnalyzePayload | null,
  strategyRegistry?: StrategyRegistryAnalyzePayload | null,
  options?: { isLiveContext?: boolean },
): AnalyzeApiResponse {
  if (!payload?.settings.adaptiveWeightingEnabled || !response.tradingDesk) {
    return response;
  }

  const { settings } = payload;
  if (options?.isLiveContext) {
    if (settings.paperOnlyAdaptiveMode) return response;
    if (!settings.liveAdaptiveApproval) return response;
  }

  const desk = response.tradingDesk;
  const dataTrustCritical =
    response.dataTrust?.grade === "CRITICAL" ||
    response.conflictGate?.tradeBlocked === true;
  const preMortemBlock = response.preMortem?.preMortemVerdict === "BLOCK";

  const weighted = runAdaptiveWeighting({
    settings,
    marketRegime: desk.marketRegime,
    riskProfile: engineInput.deskRiskProfile ?? "balanced",
    agents: desk.agents,
    originalVerdict: desk.committee.finalVerdict,
    agentEvaluations: payload.agentLeaderboard,
    relevantMemory: desk.deskMemory.relevantMemory,
    strategyRegistry,
    governance,
    riskVeto: desk.committee.riskVeto || desk.riskManager.veto === true,
    dataTrustCritical,
    preMortemBlock,
    targetAsset: "BTCUSDT",
    targetStrategy: resolveTargetStrategy(strategyRegistry),
    totalResolvedTrades: payload.totalResolvedTrades,
    isLiveContext: options?.isLiveContext ?? false,
  });

  if (!weighted) return response;

  return {
    ...response,
    tradingDesk: {
      ...desk,
      weightedCommittee: weighted,
    },
  };
}
