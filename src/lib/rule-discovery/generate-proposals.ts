import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type {
  AutoDiscoveredRuleProposal,
  DiscoveredPattern,
  DiscoveredRuleType,
} from "./types";
import { simulateProposalImpact } from "./simulate-proposal-impact";

function ruleId(): string {
  return `disc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function titleFromPattern(pattern: DiscoveredPattern): string {
  return `${pattern.suggestedRuleType}: ${pattern.category.replace(/_/g, " ")}`;
}

function descriptionFromPattern(pattern: DiscoveredPattern): string {
  return `${pattern.condition} — ${pattern.rationale}`;
}

function requiresStrongApproval(
  ruleType: DiscoveredRuleType,
  scope: DiscoveredPattern["suggestedScope"],
): boolean {
  if (scope.paperMode === "LIVE" || scope.productType === "LIVE") return true;
  if (ruleType === "SIZE_INCREASE") return true;
  if (ruleType === "BLOCK" && scope.paperMode === undefined) return false;
  return ruleType === "BLOCK" && Boolean(scope.paperMode);
}

export function patternToProposal(
  pattern: DiscoveredPattern,
  entries: DecisionLogEntry[],
  orders?: PaperOrder[],
  lifecycle: AutoDiscoveredRuleProposal["lifecycle"] = "proposed",
): AutoDiscoveredRuleProposal {
  const now = new Date().toISOString();
  const proposal: AutoDiscoveredRuleProposal = {
    ruleId: ruleId(),
    ruleType: pattern.suggestedRuleType,
    condition: pattern.condition,
    rationale: pattern.rationale,
    supportingTrades: pattern.supportingTradeIds,
    estimatedImpact: {
      ruleId: "",
      affectedDecisions: 0,
      blockedWinningTrades: 0,
      blockedLosingTrades: 0,
      allowedWinningTrades: 0,
      allowedLosingTrades: 0,
      netImpactR: 0,
      recommendation: "NEED_MORE_DATA",
      explanation: "",
      expectedAvoidedLosses: 0,
      missedProfits: 0,
      tradeFrequencyChangePct: 0,
      netImpactPct: 0,
    },
    confidence: pattern.confidence,
    suggestedScope: pattern.suggestedScope,
    humanApprovalRequired: true,
    lifecycle,
    patternId: pattern.patternId,
    category: pattern.category,
    title: titleFromPattern(pattern),
    description: descriptionFromPattern(pattern),
    createdAt: now,
    updatedAt: now,
    reviewedAt: null,
    reviewerNote: null,
    editedCondition: null,
    linkedDraftRuleId: null,
    linkedStrategyId: pattern.suggestedScope.strategyId ?? null,
    requiresStrongApproval: requiresStrongApproval(
      pattern.suggestedRuleType,
      pattern.suggestedScope,
    ),
    reversible: true,
  };

  proposal.estimatedImpact = simulateProposalImpact({
    proposal,
    entries,
    orders,
  });
  proposal.estimatedImpact.ruleId = proposal.ruleId;

  return proposal;
}

export function generateProposalsFromPatterns(
  patterns: DiscoveredPattern[],
  entries: DecisionLogEntry[],
  orders?: PaperOrder[],
): AutoDiscoveredRuleProposal[] {
  return patterns
    .filter((p) => p.confidence >= 55)
    .slice(0, 12)
    .map((p) => patternToProposal(p, entries, orders, "proposed"));
}
