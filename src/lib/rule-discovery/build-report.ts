import type { RuleDiscoveryInput, RuleDiscoveryReport } from "./types";
import { RULE_DISCOVERY_SAFETY_NOTICE } from "./types";
import { discoverPatterns } from "./discover-patterns";
import { generateProposalsFromPatterns } from "./generate-proposals";
import type { AutoDiscoveredRuleProposal } from "./types";

export function buildRuleDiscoveryReport(
  input: RuleDiscoveryInput,
  storedProposals: AutoDiscoveredRuleProposal[] = [],
): RuleDiscoveryReport {
  const patterns = discoverPatterns({
    entries: input.entries,
    orders: input.orders,
    evaluations: input.evaluations,
    memoryGraph: input.memoryGraph,
    registryStrategies: input.registryStrategies,
  });

  const freshProposals = generateProposalsFromPatterns(
    patterns,
    input.entries,
    input.orders,
  );

  const proposalMap = new Map<string, AutoDiscoveredRuleProposal>();
  for (const p of storedProposals) proposalMap.set(p.ruleId, p);
  for (const p of freshProposals) {
    if (![...proposalMap.values()].some((x) => x.patternId === p.patternId)) {
      proposalMap.set(p.ruleId, p);
    }
  }
  const proposals = [...proposalMap.values()].sort((a, b) =>
    b.confidence - a.confidence,
  );

  const discovered = proposals.filter((p) => p.lifecycle === "discovered");
  const proposed = proposals.filter((p) => p.lifecycle === "proposed");
  const approvalQueue = proposals.filter((p) =>
    ["discovered", "proposed"].includes(p.lifecycle),
  );
  const rejected = proposals.filter((p) => p.lifecycle === "rejected");
  const activeRules = proposals.filter((p) =>
    ["approved", "active", "paused"].includes(p.lifecycle),
  );

  const performanceAfterApproval = activeRules.map((p) => ({
    ruleId: p.ruleId,
    title: p.title,
    linkedDraftRuleId: p.linkedDraftRuleId,
    lifecycle: p.lifecycle,
    estimatedNetImpactPct: p.estimatedImpact.netImpactPct,
    supportingTrades: p.supportingTrades.length,
  }));

  return {
    generatedAt: new Date().toISOString(),
    patterns,
    proposals,
    discovered,
    proposed,
    approvalQueue,
    rejected,
    activeRules,
    performanceAfterApproval,
    safetyNotice: RULE_DISCOVERY_SAFETY_NOTICE,
    noAutoApproval: true,
    noDirectLiveChanges: true,
  };
}
