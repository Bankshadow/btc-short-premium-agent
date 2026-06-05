export * from "./types";
export { discoverPatterns } from "./discover-patterns";
export { patternToProposal, generateProposalsFromPatterns } from "./generate-proposals";
export { simulateProposalImpact } from "./simulate-proposal-impact";
export { proposalMatchesEntry, wouldProposalAffectTrade } from "./match-rule";
export { buildRuleDiscoveryReport } from "./build-report";
export { runRuleDiscovery } from "./run-discovery";
export {
  loadDiscoveredProposals,
  saveDiscoveredProposals,
  mergeDiscoveredProposals,
  updateProposalLifecycle,
  getProposalById,
  RULE_DISCOVERY_STORAGE_KEY,
} from "./proposal-store";
export {
  approveDiscoveredRule,
  approveDiscoveredRulePure,
  rejectDiscoveredRule,
  pauseDiscoveredRule,
  retireDiscoveredRule,
  editDiscoveredProposal,
  createDraftRuleFromDiscovery,
} from "./apply-proposal";
