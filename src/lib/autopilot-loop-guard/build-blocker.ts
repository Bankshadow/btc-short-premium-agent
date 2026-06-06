import type { OperatorAction } from "@/lib/operator-action-queue/types";
import type { LoopGuardBlocker, LoopGuardDecision } from "./types";

export function buildLoopGuardBlocker(
  decision: LoopGuardDecision,
): LoopGuardBlocker {
  if (!decision.stopLoop) {
    return {
      active: false,
      reason: "",
      stoppedAt: null,
      actionItemId: null,
      loopRiskLevel: null,
      metrics: null,
    };
  }

  const actionItemId = `oa-loop-guard-${Date.now()}`;
  return {
    active: true,
    reason: decision.reason,
    stoppedAt: new Date().toISOString(),
    actionItemId,
    loopRiskLevel: decision.level,
    metrics: decision.metrics,
  };
}

export function buildStuckOperatorAction(
  decision: LoopGuardDecision,
  blocker: LoopGuardBlocker,
): OperatorAction {
  const metrics = decision.metrics;
  return {
    actionId: blocker.actionItemId ?? `oa-loop-guard-${Date.now()}`,
    type: "REVIEW_RISK_BLOCKER",
    priority: "CRITICAL",
    title: "Autopilot loop stopped",
    description:
      decision.selfCheckSummary ??
      `Loop guard detected a stuck pattern. Diversity ${(metrics.actionDiversity * 100).toFixed(0)}%, success ${(metrics.successRate * 100).toFixed(0)}%.`,
    reason: decision.reason,
    linkedDecisionLogId: null,
    linkedTradeId: null,
    linkedModule: "autopilot-loop-guard",
    requiresHumanApproval: true,
    status: "OPEN",
    createdAt: blocker.stoppedAt ?? new Date().toISOString(),
  };
}
