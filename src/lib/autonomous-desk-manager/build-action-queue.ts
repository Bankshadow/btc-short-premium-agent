import type { DeskAutomationResult } from "@/lib/automation/automation-types";
import type { LearningEvaluationReport } from "@/lib/self-learning/types";
import type { RuleDiscoveryReport } from "@/lib/rule-discovery/types";
import type { AdaptationAnalysisResult } from "@/lib/strategy-adaptation/types";
import type { ExperimentLabReport } from "@/lib/strategy-experiments/types";
import type { RiskSummary } from "./types";
import type { DeskManagerAction, DeskManagerCycleType } from "./types";

function makeAction(
  partial: Omit<DeskManagerAction, "requiresApproval" | "status" | "resolvedAt">,
): DeskManagerAction {
  return {
    ...partial,
    status: partial.type === "NO_ACTION" ? "RESOLVED" : "PENDING",
    requiresApproval: true,
    resolvedAt: partial.type === "NO_ACTION" ? new Date().toISOString() : null,
  };
}

export function buildActionQueue(input: {
  runId: string;
  cycleType: DeskManagerCycleType;
  automation?: DeskAutomationResult | null;
  learning?: LearningEvaluationReport | null;
  ruleDiscovery?: RuleDiscoveryReport | null;
  adaptation?: AdaptationAnalysisResult | null;
  experiments?: ExperimentLabReport | null;
  risk: RiskSummary;
  newTradeIds?: string[];
}): DeskManagerAction[] {
  const actions: DeskManagerAction[] = [];
  const ts = new Date().toISOString();

  for (const tradeId of input.newTradeIds ?? []) {
    actions.push(
      makeAction({
        actionId: `${input.runId}-review-${tradeId}`,
        type: "REVIEW_TRADE",
        priority: "MEDIUM",
        reason: "Newly closed trade evaluated — review outcome and agent grades",
        evidence: ["Self-learning batch evaluation"],
        linkedTrades: [tradeId],
        linkedAgents: [],
        linkedProposals: [],
        createdAt: ts,
        runId: input.runId,
      }),
    );
  }

  const pendingRules = (input.ruleDiscovery?.proposals ?? []).filter(
    (p) => p.lifecycle === "proposed" || p.lifecycle === "discovered",
  );
  for (const rule of pendingRules.slice(0, 3)) {
    actions.push(
      makeAction({
        actionId: `${input.runId}-rule-${rule.ruleId}`,
        type: "APPROVE_RULE",
        priority: rule.confidence >= 70 ? "HIGH" : "MEDIUM",
        reason: `Rule discovery: ${rule.title}`,
        evidence: [
          rule.rationale,
          `Impact net ${rule.estimatedImpact.netImpactPct}%`,
        ],
        linkedTrades: rule.supportingTrades ?? [],
        linkedAgents: rule.suggestedScope.agentName
          ? [rule.suggestedScope.agentName]
          : [],
        linkedProposals: [rule.ruleId],
        createdAt: ts,
        runId: input.runId,
      }),
    );
  }

  const pendingAdapt = (input.adaptation?.proposals ?? []).filter(
    (p) => p.status === "PENDING",
  );
  for (const proposal of pendingAdapt.slice(0, 3)) {
    const isPause = proposal.type === "PAUSE" || proposal.type === "DEMOTE";
    actions.push(
      makeAction({
        actionId: `${input.runId}-adapt-${proposal.proposalId}`,
        type: isPause ? "PAUSE_STRATEGY" : "REVIEW_STRATEGY",
        priority: proposal.riskImpact === "HIGH" ? "HIGH" : "MEDIUM",
        reason: proposal.reason,
        evidence: [
          proposal.expectedBehaviorChange,
          `Win rate ${proposal.supportingStats.winRate}% (n=${proposal.supportingStats.sampleSize})`,
        ],
        linkedTrades: [],
        linkedAgents: [],
        linkedProposals: [proposal.proposalId],
        createdAt: ts,
        runId: input.runId,
      }),
    );
  }

  const activeExperiments = input.experiments?.activeExperiments ?? [];
  for (const exp of activeExperiments.slice(0, 2)) {
    actions.push(
      makeAction({
        actionId: `${input.runId}-exp-run-${exp.experimentId}`,
        type: "RUN_EXPERIMENT",
        priority: "LOW",
        reason: `Active experiment needs review: ${exp.hypothesis.summary}`,
        evidence: [exp.mode, `Status ${exp.status}`],
        linkedTrades: [],
        linkedAgents: [],
        linkedProposals: [exp.experimentId],
        createdAt: ts,
        runId: input.runId,
      }),
    );
  }

  for (const exp of (input.experiments?.completedResults ?? []).slice(0, 2)) {
    actions.push(
      makeAction({
        actionId: `${input.runId}-exp-close-${exp.experimentId}`,
        type: "CLOSE_EXPERIMENT",
        priority: "MEDIUM",
        reason: `Experiment ready for promotion review: ${exp.hypothesis.summary}`,
        evidence: [`Status ${exp.status}`],
        linkedTrades: [],
        linkedAgents: [],
        linkedProposals: [exp.experimentId],
        createdAt: ts,
        runId: input.runId,
      }),
    );
  }
  for (const promo of (input.experiments?.promotionCandidates ?? [])
    .filter((p) => p.status === "PENDING")
    .slice(0, 2)) {
    actions.push(
      makeAction({
        actionId: `${input.runId}-exp-promo-${promo.proposalId}`,
        type: "CLOSE_EXPERIMENT",
        priority: "HIGH",
        reason: `Promotion candidate: ${promo.reason}`,
        evidence: [
          `Win rate ${promo.supportingStats.winRate}%`,
          `Net PnL ${promo.supportingStats.netPnlPct}%`,
        ],
        linkedTrades: [],
        linkedAgents: [],
        linkedProposals: [promo.proposalId],
        createdAt: ts,
        runId: input.runId,
      }),
    );
  }

  if (
    input.risk.escalationLevel === "CRITICAL" ||
    input.risk.escalationLevel === "ELEVATED"
  ) {
    actions.push(
      makeAction({
        actionId: `${input.runId}-risk-escalation`,
        type: "ESCALATE_RISK",
        priority: "HIGH",
        reason: `Risk level ${input.risk.escalationLevel} — operator review required`,
        evidence: input.risk.notes,
        linkedTrades: [],
        linkedAgents: [],
        linkedProposals: [],
        createdAt: ts,
        runId: input.runId,
      }),
    );
  }

  const automationActions = input.automation?.actions ?? [];
  for (const auto of automationActions.filter((a) => !a.autoApplicable).slice(0, 3)) {
    if (auto.type === "REVIEW_BTC_TRADE") {
      actions.push(
        makeAction({
          actionId: `${input.runId}-auto-${auto.id}`,
          type: "REVIEW_TRADE",
          priority: auto.priority,
          reason: auto.title,
          evidence: [auto.detail],
          linkedTrades: [],
          linkedAgents: [],
          linkedProposals: [],
          createdAt: ts,
          runId: input.runId,
        }),
      );
    }
  }

  actions.push(
    makeAction({
      actionId: `${input.runId}-briefing`,
      type: "SEND_BRIEFING",
      priority: "LOW",
      reason: "Operator briefing generated for this desk manager cycle",
      evidence: [`Cycle ${input.cycleType}`],
      linkedTrades: [],
      linkedAgents: [],
      linkedProposals: [],
      createdAt: ts,
      runId: input.runId,
    }),
  );

  if (actions.filter((a) => a.type !== "SEND_BRIEFING" && a.type !== "NO_ACTION").length === 0) {
    actions.unshift(
      makeAction({
        actionId: `${input.runId}-no-action`,
        type: "NO_ACTION",
        priority: "LOW",
        reason: "No material operator actions this cycle",
        evidence: ["All learning modules ran without pending approvals"],
        linkedTrades: [],
        linkedAgents: [],
        linkedProposals: [],
        createdAt: ts,
        runId: input.runId,
      }),
    );
  }

  return actions;
}
