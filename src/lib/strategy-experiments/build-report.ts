import type { ExperimentLabReport, StrategyExperiment } from "./types";
import { EXPERIMENT_SAFETY_NOTICE } from "./types";
import type { ExperimentAuditEntry } from "./types";

export function buildExperimentLabReport(
  experiments: StrategyExperiment[],
  auditLog: ExperimentAuditEntry[] = [],
): ExperimentLabReport {
  const activeExperiments = experiments.filter((e) =>
    ["draft", "running", "active", "promotion_pending"].includes(e.status),
  );

  const completedResults = experiments.filter((e) =>
    ["completed", "promoted"].includes(e.status) && e.result != null,
  );

  const failedHypotheses = experiments.filter(
    (e) => e.status === "failed" || e.result?.passedFailure === true,
  );

  const promotionCandidates = experiments
    .filter((e) => e.promotionProposal?.status === "PENDING")
    .map((e) => e.promotionProposal!)
    .concat(
      experiments
        .filter((e) => e.promotionProposal?.status === "APPROVED")
        .map((e) => e.promotionProposal!),
    );

  const shadowTrades = experiments
    .flatMap((e) => e.shadowTrades)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 30);

  return {
    generatedAt: new Date().toISOString(),
    activeExperiments,
    completedResults,
    shadowTrades,
    promotionCandidates,
    failedHypotheses,
    auditLog: auditLog.slice(0, 50),
    safetyNotice: EXPERIMENT_SAFETY_NOTICE,
    cannotPlaceLiveTrades: true,
    cannotChangeActiveWithoutApproval: true,
  };
}
