import type { AgentCritique, AgentProposal, CommitteeSummary } from "./collaboration-types";

export function buildCommitteeSummary(input: {
  collaborationId: string;
  runId: string;
  proposals: AgentProposal[];
  critiques: AgentCritique[];
}): CommitteeSummary {
  const hasBlockCritique = input.critiques.some((c) => c.severity === "BLOCK");
  const tradeProposal = input.proposals.find((p) => p.agentId === "market-analyst");

  let finalRecommendation: CommitteeSummary["finalRecommendation"] = "WAIT";
  if (hasBlockCritique) finalRecommendation = "BLOCKED";
  else if (tradeProposal?.proposal.toLowerCase().includes("wait")) finalRecommendation = "WAIT";

  const dissentingViews = input.critiques
    .filter((c) => c.severity !== "INFO")
    .map((c) => `${c.role} challenges ${c.targetAgentId}: ${c.critique}`);

  return {
    collaborationId: input.collaborationId,
    runId: input.runId,
    proposals: input.proposals,
    critiques: input.critiques,
    dissentingViews,
    finalRecommendation,
    riskNotes: [
      "Collaboration is advisory only — cannot execute or override risk gate.",
      ...dissentingViews.slice(0, 3),
    ],
    advisoryOnly: true,
    createdAt: new Date().toISOString(),
  };
}
