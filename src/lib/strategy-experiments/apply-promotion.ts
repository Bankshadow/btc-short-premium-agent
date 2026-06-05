import { patchStrategyOverride } from "@/lib/strategy-registry/strategy-registry-store";
import type { StrategySkill } from "@/lib/strategy-registry/strategy-registry-types";
import type {
  ExperimentAuditEntry,
  ExperimentPromotionProposal,
  PromoteExperimentInput,
  StrategyExperiment,
} from "./types";

function auditId(): string {
  return `exp-audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function applyPromotionPure(input: {
  experiment: StrategyExperiment;
  proposal: ExperimentPromotionProposal;
  action: PromoteExperimentInput["action"];
  reviewerNote?: string;
}): {
  experiment: StrategyExperiment;
  proposal: ExperimentPromotionProposal;
  auditEntry: ExperimentAuditEntry;
  registryPatch?: { strategyId: string; status: string; note: string };
} | null {
  const { experiment, proposal, action, reviewerNote } = input;
  const now = new Date().toISOString();

  if (action === "reject") {
    return {
      experiment: { ...experiment, status: "completed", updatedAt: now },
      proposal: {
        ...proposal,
        status: "REJECTED",
        reviewedAt: now,
        reviewerNote: reviewerNote ?? "Rejected by operator",
      },
      auditEntry: {
        id: auditId(),
        timestamp: now,
        experimentId: experiment.experimentId,
        action: "PROMOTION_REJECTED",
        detail: `Promotion rejected for ${proposal.targetStrategy}`,
        actorNote: reviewerNote,
      },
    };
  }

  if (action === "approve") {
    return {
      experiment: { ...experiment, status: "promotion_pending", updatedAt: now },
      proposal: {
        ...proposal,
        status: "APPROVED",
        reviewedAt: now,
        reviewerNote: reviewerNote ?? "Approved for registry apply",
      },
      auditEntry: {
        id: auditId(),
        timestamp: now,
        experimentId: experiment.experimentId,
        action: "PROMOTION_APPROVED",
        detail: `Approved promotion to ${proposal.proposedRegistryStatus}`,
        actorNote: reviewerNote,
      },
    };
  }

  if (action === "apply") {
    if (proposal.status !== "APPROVED") return null;

    const note = `[EXPERIMENT] ${experiment.label} — ${proposal.reason}`;
    return {
      experiment: {
        ...experiment,
        status: "promoted",
        promotionProposal: { ...proposal, status: "APPLIED", reviewedAt: now },
        updatedAt: now,
      },
      proposal: {
        ...proposal,
        status: "APPLIED",
        reviewedAt: now,
        reviewerNote: reviewerNote ?? "Applied to strategy registry",
      },
      auditEntry: {
        id: auditId(),
        timestamp: now,
        experimentId: experiment.experimentId,
        action: "PROMOTION_APPLIED",
        detail: `Registry → ${proposal.proposedRegistryStatus} for ${proposal.targetStrategy}`,
        actorNote: reviewerNote,
      },
      registryPatch: {
        strategyId: proposal.targetStrategy,
        status: proposal.proposedRegistryStatus,
        note,
      },
    };
  }

  return null;
}

export function applyPromotionToRegistry(
  patch: { strategyId: string; status: string; note: string },
  _skills?: StrategySkill[],
): void {
  patchStrategyOverride(
    patch.strategyId as import("@/lib/validation/validation-types").StrategyId,
    { status: patch.status as import("@/lib/strategy-registry/strategy-registry-types").StrategyRegistryStatus, statusLocked: true },
    patch.note,
  );
}
