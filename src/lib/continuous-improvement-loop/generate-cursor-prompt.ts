import type { ImprovementCommitteeReview, ImprovementProposal } from "./types";
import { ISSUE_TYPE_LABELS } from "./config";

export function generateImprovementCursorPrompt(input: {
  proposal: ImprovementProposal;
  committee: ImprovementCommitteeReview;
}): string {
  const p = input.proposal;
  const c = input.committee;
  return [
    "You are working on btc-short-premium-agent.",
    "",
    `MVP 87 — Continuous Improvement: ${p.title}`,
    "",
    `Issue type: ${ISSUE_TYPE_LABELS[p.issueType]}`,
    "",
    "Problem:",
    p.problem,
    "",
    "Why now:",
    p.whyNow,
    "",
    "Expected impact:",
    p.expectedImpact,
    "",
    "Implementation scope:",
    p.implementationScope,
    "",
    "Affected pages:",
    ...p.affectedPages.map((page) => `- ${page}`),
    "",
    "Affected APIs:",
    ...p.affectedAPIs.map((api) => `- ${api}`),
    "",
    "Affected modules:",
    ...p.affectedModules.map((mod) => `- ${mod}`),
    "",
    "Committee review:",
    `- Recommendation: ${c.recommendation}`,
    `- Summary: ${c.summary}`,
    ...c.topReasons.map((r) => `- ${r}`),
    "",
    "Evidence:",
    ...p.detectedIssue.evidence.map((e) => `- ${e}`),
    "",
    "SAFETY CONSTRAINTS (mandatory):",
    "- Do NOT enable live trading.",
    "- Do NOT auto-merge — human reviews PR.",
    "- Do NOT weaken risk gates, loop guard, or double confirm.",
    "- Preserve advisory-only automation boundaries.",
    "",
    "Acceptance criteria:",
    ...p.acceptanceCriteria.map((rule) => `- ${rule}`),
    "",
    "Deliverables:",
    "- Focused code fix with tests where relevant.",
    "- Short implementation summary for operator.",
    "- Note how to verify on testnet/paper only.",
  ].join("\n");
}
