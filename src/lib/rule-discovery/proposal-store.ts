import type {
  AutoDiscoveredRuleProposal,
  RuleLifecycleStatus,
} from "./types";

export const RULE_DISCOVERY_STORAGE_KEY =
  "btc-desk:rule-discovery-proposals";

export function loadDiscoveredProposals(): AutoDiscoveredRuleProposal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RULE_DISCOVERY_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AutoDiscoveredRuleProposal[];
  } catch {
    return [];
  }
}

function persist(proposals: AutoDiscoveredRuleProposal[]): AutoDiscoveredRuleProposal[] {
  if (typeof window !== "undefined") {
    localStorage.setItem(RULE_DISCOVERY_STORAGE_KEY, JSON.stringify(proposals));
  }
  return proposals;
}

export function saveDiscoveredProposals(
  proposals: AutoDiscoveredRuleProposal[],
): AutoDiscoveredRuleProposal[] {
  return persist(proposals);
}

export function mergeDiscoveredProposals(
  incoming: AutoDiscoveredRuleProposal[],
): AutoDiscoveredRuleProposal[] {
  const existing = loadDiscoveredProposals();
  const byPattern = new Map(existing.map((p) => [p.patternId, p]));

  for (const proposal of incoming) {
    const prev = byPattern.get(proposal.patternId);
    if (!prev) {
      byPattern.set(proposal.patternId, proposal);
      continue;
    }
    if (
      ["approved", "active", "paused"].includes(prev.lifecycle) ||
      prev.lifecycle === "rejected"
    ) {
      continue;
    }
    byPattern.set(proposal.patternId, {
      ...proposal,
      ruleId: prev.ruleId,
      lifecycle: prev.lifecycle === "discovered" ? "proposed" : prev.lifecycle,
      linkedDraftRuleId: prev.linkedDraftRuleId,
      reviewedAt: prev.reviewedAt,
      reviewerNote: prev.reviewerNote,
      editedCondition: prev.editedCondition,
    });
  }

  return persist(
    [...byPattern.values()].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    ),
  );
}

export function updateProposalLifecycle(
  ruleId: string,
  lifecycle: RuleLifecycleStatus,
  patch?: Partial<AutoDiscoveredRuleProposal>,
): AutoDiscoveredRuleProposal | null {
  const proposals = loadDiscoveredProposals();
  const idx = proposals.findIndex((p) => p.ruleId === ruleId);
  if (idx < 0) return null;

  const updated: AutoDiscoveredRuleProposal = {
    ...proposals[idx],
    ...patch,
    lifecycle,
    updatedAt: new Date().toISOString(),
    reviewedAt: patch?.reviewedAt ?? new Date().toISOString(),
  };
  proposals[idx] = updated;
  persist(proposals);
  return updated;
}

export function getProposalById(
  ruleId: string,
): AutoDiscoveredRuleProposal | null {
  return loadDiscoveredProposals().find((p) => p.ruleId === ruleId) ?? null;
}
