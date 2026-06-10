import { appendEvent } from "@/lib/journal/journal-query";
import { createStrategyVersionFromImprovement } from "@/lib/versioning/change-control";
import { getImprovementById, proposalRequiresEvidence } from "./proposal-generator";
import type { ImprovementProposal } from "./improvement-types";

export async function approveImprovement(
  improvementId: string,
  decidedBy = "operator",
): Promise<{ ok: boolean; proposal: ImprovementProposal | null; message: string }> {
  const proposal = await getImprovementById(improvementId);
  if (!proposal) return { ok: false, proposal: null, message: "Proposal not found." };
  if (proposal.status !== "PENDING") {
    return { ok: false, proposal, message: `Proposal already ${proposal.status}.` };
  }
  if (!proposalRequiresEvidence(proposal)) {
    return { ok: false, proposal, message: "Proposal requires evidence citations." };
  }

  await appendEvent({
    type: "IMPROVEMENT_APPROVED",
    environment: "testnet",
    payload: { improvementId, decidedBy, type: proposal.type },
  });

  await createStrategyVersionFromImprovement(proposal, decidedBy);

  return {
    ok: true,
    proposal: { ...proposal, status: "APPROVED", decidedAt: new Date().toISOString(), decidedBy },
    message: "Improvement approved — strategy version created. No auto-apply without version.",
  };
}

export async function rejectImprovement(
  improvementId: string,
  reason: string,
  decidedBy = "operator",
): Promise<{ ok: boolean; message: string }> {
  const proposal = await getImprovementById(improvementId);
  if (!proposal) return { ok: false, message: "Proposal not found." };

  await appendEvent({
    type: "IMPROVEMENT_REJECTED",
    environment: "testnet",
    payload: { improvementId, reason, decidedBy },
  });

  return { ok: true, message: "Improvement rejected and logged." };
}
