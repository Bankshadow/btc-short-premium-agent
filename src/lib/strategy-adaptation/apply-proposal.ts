import type { StrategyId } from "@/lib/validation/validation-types";
import type { StrategySkill } from "@/lib/strategy-registry/strategy-registry-types";
import type {
  AdaptationApplyInput,
  AdaptationApplyResult,
  AdaptationAuditEntry,
  StrategyAdaptationProposal,
} from "./types";

const LIVE_RISK_STRATEGIES: StrategyId[] = ["aggressive_risk_mode"];

function newAuditId(): string {
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function blocksLiveOrRiskIncrease(
  proposal: StrategyAdaptationProposal,
  skill: StrategySkill | undefined,
): string | null {
  if (proposal.type === "PROMOTE" && proposal.proposedRegistryStatus === "ACTIVE") {
    if (LIVE_RISK_STRATEGIES.includes(proposal.targetStrategy)) {
      return "Cannot promote aggressive risk mode to ACTIVE via adaptation.";
    }
  }
  if (
    proposal.type === "RELAX_RULE" &&
    proposal.targetStrategy === "aggressive_risk_mode"
  ) {
    return "Cannot relax rules on aggressive risk mode.";
  }
  if (skill?.status === "DEPRECATED" && proposal.type === "PROMOTE") {
    return "Cannot promote deprecated strategy without manual registry review.";
  }
  return null;
}

export function applyAdaptationProposal(
  input: AdaptationApplyInput,
): AdaptationApplyResult {
  const skill = input.registry.strategies.find(
    (s) => s.id === input.proposal.targetStrategy,
  );
  const proposal = { ...input.proposal };

  if (input.action === "reject") {
    return {
      ok: true,
      proposal: {
        ...proposal,
        status: "REJECTED",
        reviewedAt: new Date().toISOString(),
        reviewerNote: input.operatorNote ?? "Rejected by operator",
      },
      auditEntry: {
        id: newAuditId(),
        timestamp: new Date().toISOString(),
        proposalId: proposal.proposalId,
        action: "REJECTED",
        operatorNote: input.operatorNote ?? "",
        targetStrategy: proposal.targetStrategy,
        proposalType: proposal.type,
        beforeStatus: skill?.status ?? null,
        afterStatus: skill?.status ?? null,
        reversible: true,
      },
    };
  }

  if (input.action === "approve") {
    return {
      ok: true,
      proposal: {
        ...proposal,
        status: "APPROVED",
        reviewedAt: new Date().toISOString(),
        reviewerNote: input.operatorNote ?? "Approved for apply",
        editedReason: input.editedReason ?? proposal.editedReason,
        reason: input.editedReason ?? proposal.reason,
      },
      auditEntry: {
        id: newAuditId(),
        timestamp: new Date().toISOString(),
        proposalId: proposal.proposalId,
        action: "APPROVED",
        operatorNote: input.operatorNote ?? "",
        targetStrategy: proposal.targetStrategy,
        proposalType: proposal.type,
        beforeStatus: skill?.status ?? null,
        afterStatus: proposal.proposedRegistryStatus,
        reversible: true,
      },
    };
  }

  if (input.action === "edit") {
    return {
      ok: true,
      proposal: {
        ...proposal,
        editedReason: input.editedReason ?? proposal.reason,
        reason: input.editedReason ?? proposal.reason,
        reviewerNote: input.operatorNote ?? "Edited by operator",
      },
      auditEntry: {
        id: newAuditId(),
        timestamp: new Date().toISOString(),
        proposalId: proposal.proposalId,
        action: "EDITED",
        operatorNote: input.operatorNote ?? "",
        targetStrategy: proposal.targetStrategy,
        proposalType: proposal.type,
        beforeStatus: skill?.status ?? null,
        afterStatus: proposal.proposedRegistryStatus,
        reversible: true,
      },
    };
  }

  if (input.action === "apply") {
    if (proposal.status !== "APPROVED" && proposal.status !== "PENDING") {
      return { ok: false, error: "Proposal must be approved before apply." };
    }

    const block = blocksLiveOrRiskIncrease(proposal, skill);
    if (block) return { ok: false, error: block };

    if (
      proposal.type === "REVIEW_ONLY" ||
      proposal.type === "TIGHTEN_RULE" ||
      proposal.type === "RELAX_RULE"
    ) {
      return {
        ok: true,
        proposal: {
          ...proposal,
          status: "APPLIED",
          appliedAt: new Date().toISOString(),
          reviewerNote:
            input.operatorNote ??
            "Advisory proposal recorded — no registry status change.",
        },
        auditEntry: {
          id: newAuditId(),
          timestamp: new Date().toISOString(),
          proposalId: proposal.proposalId,
          action: "APPLIED",
          operatorNote: input.operatorNote ?? "Advisory only",
          targetStrategy: proposal.targetStrategy,
          proposalType: proposal.type,
          beforeStatus: skill?.status ?? null,
          afterStatus: skill?.status ?? null,
          reversible: true,
        },
      };
    }

    const nextStatus = proposal.proposedRegistryStatus;
    if (!nextStatus) {
      return { ok: false, error: "No proposed registry status for apply." };
    }

    return {
      ok: true,
      proposal: {
        ...proposal,
        status: "APPLIED",
        appliedAt: new Date().toISOString(),
        previousRegistryStatus: skill?.status ?? null,
        reviewerNote: input.operatorNote ?? "Applied to strategy registry",
      },
      registryPatch: {
        strategyId: proposal.targetStrategy,
        status: nextStatus,
        statusLocked: true,
        versionNote: `Adaptation ${proposal.type}: ${proposal.reason}`,
      },
      auditEntry: {
        id: newAuditId(),
        timestamp: new Date().toISOString(),
        proposalId: proposal.proposalId,
        action: "APPLIED",
        operatorNote: input.operatorNote ?? "",
        targetStrategy: proposal.targetStrategy,
        proposalType: proposal.type,
        beforeStatus: skill?.status ?? null,
        afterStatus: nextStatus,
        reversible: true,
      },
    };
  }

  if (input.action === "revert") {
    const prev = proposal.previousRegistryStatus;
    if (!prev) {
      return { ok: false, error: "No previous status to revert." };
    }
    return {
      ok: true,
      proposal: { ...proposal, status: "REVERTED" },
      registryPatch: {
        strategyId: proposal.targetStrategy,
        status: prev,
        statusLocked: true,
        versionNote: `Reverted adaptation ${proposal.proposalId}`,
      },
      auditEntry: {
        id: newAuditId(),
        timestamp: new Date().toISOString(),
        proposalId: proposal.proposalId,
        action: "REVERTED",
        operatorNote: input.operatorNote ?? "Reverted by operator",
        targetStrategy: proposal.targetStrategy,
        proposalType: proposal.type,
        beforeStatus: skill?.status ?? null,
        afterStatus: prev,
        reversible: false,
      },
    };
  }

  return { ok: false, error: "Unknown action." };
}
