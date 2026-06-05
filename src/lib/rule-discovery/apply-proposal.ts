import { loadDraftRules, saveDraftRules } from "@/lib/journal/draft-rules";
import { linkDraftRuleToStrategy } from "@/lib/strategy-registry/strategy-registry-actions";
import type { DraftRule } from "@/lib/journal/draft-rules";
import type {
  ApproveDiscoveredRuleInput,
  AutoDiscoveredRuleProposal,
  RejectDiscoveredRuleInput,
} from "./types";
import { getProposalById, updateProposalLifecycle } from "./proposal-store";

export function createDraftRuleFromDiscovery(
  proposal: AutoDiscoveredRuleProposal,
  editedCondition?: string,
): DraftRule {
  const condition = editedCondition ?? proposal.editedCondition ?? proposal.condition;
  const rule: DraftRule = {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sourceEntryId: proposal.supportingTrades[0] ?? "discovery",
    createdAt: new Date().toISOString(),
    status: "approved",
    title: `[Discovered] ${proposal.title}`,
    description: `${condition}\n\n${proposal.rationale}`,
    fromReflection: false,
    linkedStrategyId: proposal.linkedStrategyId ?? proposal.suggestedScope.strategyId,
  };
  saveDraftRules([rule, ...loadDraftRules()]);
  return rule;
}

export function approveDiscoveredRulePure(
  proposal: AutoDiscoveredRuleProposal,
  input: ApproveDiscoveredRuleInput,
): { proposal: AutoDiscoveredRuleProposal; draftRule: DraftRule } | null {
  if (proposal.lifecycle === "rejected" || proposal.lifecycle === "retired") {
    return null;
  }

  const condition = input.editedCondition ?? proposal.editedCondition ?? proposal.condition;
  const draftRule: DraftRule = {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sourceEntryId: proposal.supportingTrades[0] ?? "discovery",
    createdAt: new Date().toISOString(),
    status: "approved",
    title: `[Discovered] ${proposal.title}`,
    description: `${condition}\n\n${proposal.rationale}`,
    fromReflection: false,
    linkedStrategyId:
      input.linkStrategyId ??
      proposal.linkedStrategyId ??
      proposal.suggestedScope.strategyId,
  };

  const strategyId =
    input.linkStrategyId ??
    proposal.linkedStrategyId ??
    proposal.suggestedScope.strategyId;
  const lifecycle = input.activate !== false ? "active" : "approved";

  const updated: AutoDiscoveredRuleProposal = {
    ...proposal,
    lifecycle,
    linkedDraftRuleId: draftRule.id,
    linkedStrategyId: strategyId ?? null,
    reviewerNote: input.reviewerNote ?? null,
    editedCondition: input.editedCondition ?? proposal.editedCondition,
    reviewedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return { proposal: updated, draftRule };
}

export function approveDiscoveredRule(
  input: ApproveDiscoveredRuleInput,
): { proposal: AutoDiscoveredRuleProposal; draftRule: DraftRule } | null {
  const proposal = getProposalById(input.proposalId);
  if (!proposal) return null;

  const result = approveDiscoveredRulePure(proposal, input);
  if (!result) return null;

  saveDraftRules([result.draftRule, ...loadDraftRules()]);

  const strategyId =
    input.linkStrategyId ??
    proposal.linkedStrategyId ??
    proposal.suggestedScope.strategyId;
  if (strategyId) {
    linkDraftRuleToStrategy(strategyId, result.draftRule.id);
  }

  updateProposalLifecycle(proposal.ruleId, result.proposal.lifecycle, {
    linkedDraftRuleId: result.draftRule.id,
    linkedStrategyId: strategyId ?? null,
    reviewerNote: input.reviewerNote ?? null,
    editedCondition: input.editedCondition ?? proposal.editedCondition,
    reviewedAt: result.proposal.reviewedAt,
  });

  return result;
}

export function rejectDiscoveredRule(
  input: RejectDiscoveredRuleInput,
): AutoDiscoveredRuleProposal | null {
  return updateProposalLifecycle(input.proposalId, "rejected", {
    reviewerNote: input.reviewerNote ?? "Rejected by operator",
    reviewedAt: new Date().toISOString(),
  });
}

export function pauseDiscoveredRule(ruleId: string): AutoDiscoveredRuleProposal | null {
  const proposal = getProposalById(ruleId);
  if (!proposal || !["active", "approved"].includes(proposal.lifecycle)) {
    return null;
  }
  if (proposal.linkedDraftRuleId) {
    const rules = loadDraftRules().map((r) =>
      r.id === proposal.linkedDraftRuleId
        ? { ...r, status: "rejected" as const }
        : r,
    );
    saveDraftRules(rules);
  }
  return updateProposalLifecycle(ruleId, "paused");
}

export function retireDiscoveredRule(ruleId: string): AutoDiscoveredRuleProposal | null {
  const proposal = getProposalById(ruleId);
  if (!proposal) return null;
  if (proposal.linkedDraftRuleId) {
    const rules = loadDraftRules().map((r) =>
      r.id === proposal.linkedDraftRuleId
        ? { ...r, status: "rejected" as const }
        : r,
    );
    saveDraftRules(rules);
  }
  return updateProposalLifecycle(ruleId, "retired");
}

export function editDiscoveredProposal(
  ruleId: string,
  patch: { editedCondition?: string; reviewerNote?: string },
): AutoDiscoveredRuleProposal | null {
  const proposal = getProposalById(ruleId);
  if (!proposal) return null;
  return updateProposalLifecycle(ruleId, proposal.lifecycle, {
    editedCondition: patch.editedCondition ?? proposal.editedCondition,
    reviewerNote: patch.reviewerNote ?? proposal.reviewerNote,
  });
}
