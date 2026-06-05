import type {
  ExperimentPromotionProposal,
  ExperimentResult,
  StrategyExperiment,
} from "./types";

function proposalId(): string {
  return `exp-promo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function generatePromotionProposal(
  experiment: StrategyExperiment,
  result: ExperimentResult,
): ExperimentPromotionProposal {
  const proposedStatus =
    result.netPnlPct > 2 && result.winRate >= 60
      ? "PAPER_TESTING"
      : "WATCHLIST";

  return {
    proposalId: proposalId(),
    experimentId: experiment.experimentId,
    targetStrategy: experiment.variant.targetStrategy,
    proposedRegistryStatus: proposedStatus,
    reason: `${experiment.label} passed success criteria: ${result.summary}`,
    supportingStats: {
      winRate: result.winRate,
      netPnlPct: result.netPnlPct,
      sampleSize: result.sampleSize,
      shadowAccuracyPct: result.shadowAccuracyPct,
    },
    humanApprovalRequired: true,
    status: "PENDING",
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    reviewerNote: null,
  };
}
