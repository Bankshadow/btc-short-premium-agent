import type { AgentOutput } from "@/lib/agents/types";
import type { AgentRecommendation, ConfidenceLevel } from "@/lib/agents/types";

const REC_WEIGHT: Record<AgentRecommendation, number> = {
  TRADE: 1,
  WAIT: 0,
  SKIP: -1,
};

function recValue(rec: AgentRecommendation): number {
  return REC_WEIGHT[rec];
}

function confidenceWeight(c: ConfidenceLevel): number {
  if (c === "HIGH") return 1.25;
  if (c === "MEDIUM") return 1;
  return 0.75;
}

/** Pairwise disagreement 0–100 across strategy + thesis agents. */
export function computeAgentDisagreementScore(agents: AgentOutput[]): number {
  const core = agents.filter(
    (a) =>
      a.strategyType === "OPTIONS" ||
      a.strategyType === "SPOT" ||
      a.strategyType === "FUTURES" ||
      a.strategyType === "THESIS" ||
      a.strategyType === "RISK",
  );
  if (core.length < 2) return 0;

  let weightedDelta = 0;
  let pairs = 0;

  for (let i = 0; i < core.length; i++) {
    for (let j = i + 1; j < core.length; j++) {
      const a = core[i];
      const b = core[j];
      const delta = Math.abs(recValue(a.recommendation) - recValue(b.recommendation));
      const w =
        (confidenceWeight(a.confidence) + confidenceWeight(b.confidence)) / 2;
      weightedDelta += delta * w;
      pairs += 1;
    }
  }

  if (pairs === 0) return 0;
  const maxDelta = 2;
  const raw = (weightedDelta / pairs / maxDelta) * 100;
  return Math.min(100, Math.round(raw));
}
