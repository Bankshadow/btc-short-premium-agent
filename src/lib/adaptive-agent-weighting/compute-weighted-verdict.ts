import type { AgentOutput, AgentRecommendation } from "@/lib/agents/types";
import { applyHardConstraints } from "./apply-hard-constraints";
import { buildAgentWeightProfile } from "./build-agent-weights";
import type {
  AdaptiveWeightingInput,
  AgentWeightEntry,
  WeightedCommitteeVerdict,
} from "./types";
import { ADAPTIVE_WEIGHTING_SAFETY_NOTICE } from "./types";
import { getCachedCalibrationProfile } from "@/lib/confidence-calibration/calibration-cache";
import { applyCommitteeCalibration } from "@/lib/confidence-calibration/apply-calibration";

const VOTING_AGENT_NAMES = new Set([
  "Bull Thesis Agent",
  "Bear Thesis Agent",
  "Spot Strategy Agent",
  "Futures Strategy Agent",
  "Short-Chart Agent (1H)",
  "Medium-Chart Agent (4H)",
  "Long-Chart Agent (1D)",
  "Options Strategy Agent",
]);

function confidenceMult(level: AgentOutput["confidence"]): number {
  if (level === "HIGH") return 1;
  if (level === "MEDIUM") return 0.82;
  return 0.65;
}

function recScore(
  agents: AgentOutput[],
  weightMap: Map<string, AgentWeightEntry>,
  rec: AgentRecommendation,
): number {
  let score = 0;
  for (const agent of agents) {
    if (!VOTING_AGENT_NAMES.has(agent.agentName)) continue;
    if (agent.recommendation !== rec) continue;
    const w = weightMap.get(agent.agentName)?.weight ?? 1;
    score += w * confidenceMult(agent.confidence);
  }
  return score;
}

export function computeWeightedCommitteeVerdict(
  input: AdaptiveWeightingInput,
): WeightedCommitteeVerdict | null {
  const { settings } = input;

  if (!settings.adaptiveWeightingEnabled) return null;

  if (input.isLiveContext) {
    if (settings.paperOnlyAdaptiveMode) return null;
    if (!settings.liveAdaptiveApproval) return null;
  }

  if (
    (input.totalResolvedTrades ?? 0) <
    settings.minClosedTradesBeforeWeighting
  ) {
    return null;
  }

  const votingAgents = input.agents.filter((a) =>
    VOTING_AGENT_NAMES.has(a.agentName),
  );

  const profile = buildAgentWeightProfile({
    settings,
    marketRegime: input.marketRegime,
    targetAsset: input.targetAsset ?? "BTCUSDT",
    targetStrategy: input.targetStrategy ?? "options_short_premium",
    agentEvaluations: input.agentEvaluations ?? [],
    relevantMemory: input.relevantMemory,
    totalResolvedSamples: input.totalResolvedTrades ?? 0,
  });

  const weightMap = new Map(profile.entries.map((e) => [e.agentName, e]));

  const rawTradeScore = recScore(votingAgents, weightMap, "TRADE");
  const calibrationProfile = getCachedCalibrationProfile();
  const tradeScore = applyCommitteeCalibration(
    rawTradeScore,
    calibrationProfile,
    input.step5Confidence ?? null,
  );
  const skipScore = recScore(votingAgents, weightMap, "SKIP");
  const waitScore = recScore(votingAgents, weightMap, "WAIT");

  let rawWeighted: AgentRecommendation = "WAIT";
  const max = Math.max(tradeScore, skipScore, waitScore);
  if (max === tradeScore && tradeScore > 0) rawWeighted = "TRADE";
  else if (max === skipScore && skipScore > 0) rawWeighted = "SKIP";
  else if (waitScore > 0) rawWeighted = "WAIT";

  const { finalVerdict, hardGatesApplied } = applyHardConstraints({
    weightedVerdict: rawWeighted,
    riskVeto: input.riskVeto,
    governance: input.governance,
    dataTrustCritical: input.dataTrustCritical,
    preMortemBlock: input.preMortemBlock,
  });

  const total = tradeScore + skipScore + waitScore || 1;
  const disagreementScore = Number(
    (1 - max / total).toFixed(3),
  );

  const reasonTrail: string[] = [
    ADAPTIVE_WEIGHTING_SAFETY_NOTICE,
    `Weighted scores — TRADE ${tradeScore.toFixed(2)}, SKIP ${skipScore.toFixed(2)}, WAIT ${waitScore.toFixed(2)}`,
  ];

  const topTrusted = profile.entries.find((e) => e.trustedReasons.length > 0);
  const topDown = profile.entries.find((e) => e.downweightedReasons.length > 0);
  if (topTrusted) {
    reasonTrail.push(
      `Trusted: ${topTrusted.agentName} (w=${topTrusted.weight}) — ${topTrusted.trustedReasons[0]}`,
    );
  }
  if (topDown) {
    reasonTrail.push(
      `Down-weighted: ${topDown.agentName} (w=${topDown.weight}) — ${topDown.downweightedReasons[0]}`,
    );
  }
  for (const gate of hardGatesApplied) {
    reasonTrail.push(`Hard gate: ${gate}`);
  }

  const confidenceAdjustment = Number(
    (
      (tradeScore - skipScore) /
      Math.max(1, profile.entries.length)
    ).toFixed(2),
  );

  const explanation =
    finalVerdict !== rawWeighted
      ? `Raw weighted ${rawWeighted} adjusted to ${finalVerdict} by hard gates.`
      : `Weighted committee ${finalVerdict} vs original ${input.originalVerdict}.`;

  return {
    weightedVerdict: finalVerdict,
    originalVerdict: input.originalVerdict,
    verdictDiffers: finalVerdict !== input.originalVerdict,
    weightProfile: profile,
    explanation,
    confidenceAdjustment,
    disagreementScore,
    reasonTrail,
    hardGatesApplied,
    tradeScore: Number(tradeScore.toFixed(3)),
    skipScore: Number(skipScore.toFixed(3)),
    waitScore: Number(waitScore.toFixed(3)),
    advisoryOnly: true,
    cannotEnableLive: true,
  };
}
