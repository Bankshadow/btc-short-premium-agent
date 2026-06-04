import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import { buildCouncilContext } from "./council-context";
import { runGoalStrategistAgent } from "./goal-strategist-agent";
import { runPerformanceAnalystAgent } from "./performance-analyst-agent";
import { runStrategyOptimizerAgent } from "./strategy-optimizer-agent";
import { runRiskCriticAgent } from "./risk-critic-agent";
import { runCapitalAllocatorAgent } from "./capital-allocator-agent";
import { runCommitteeModeratorAgent } from "./committee-moderator-agent";
import { COUNCIL_GUARDRAILS, type CouncilRunRequest, type CouncilSessionResult } from "./types";

export function runCouncilSession(input: {
  request: CouncilRunRequest;
  entries: DecisionLogEntry[];
  orders: PaperOrder[];
  riskProfile: DeskRiskProfile;
}): CouncilSessionResult {
  const ctx = buildCouncilContext(input);
  const { goalStatus, debate: goalDebate } = runGoalStrategistAgent(ctx);
  const perf = runPerformanceAnalystAgent(ctx);
  const { proposals, debate: optimizerDebate } = runStrategyOptimizerAgent(ctx, perf);
  const { riskReview, debate: riskDebate } = runRiskCriticAgent(ctx, proposals);
  const { capitalRecommendation, debate: capitalDebate } =
    runCapitalAllocatorAgent(ctx);

  const agentDebate = [
    goalDebate,
    perf.debate,
    optimizerDebate,
    riskDebate,
    capitalDebate,
  ];

  const { committeeDecision, councilMemo } = runCommitteeModeratorAgent({
    topic: ctx.topic,
    goalStatus,
    debate: agentDebate,
    proposals,
    riskReview,
    capitalNote: capitalRecommendation.councilNote,
  });

  return {
    councilSessionId: `council-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    topic: ctx.topic,
    goalStatus,
    agentDebate,
    proposals,
    riskReview,
    capitalRecommendation,
    committeeDecision,
    councilMemo,
    guardrails: [...COUNCIL_GUARDRAILS],
  };
}
