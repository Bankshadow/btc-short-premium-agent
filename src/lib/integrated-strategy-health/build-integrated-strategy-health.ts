import {
  blocksTestnetEntriesForHealth,
  buildStrategyHealthReportForTag,
  groupEvidenceTradesByStrategyTag,
  selectPrimaryStrategyReport,
} from "./build-strategy-health-report";
import { strategyCalibrationByTag } from "@/lib/integrated-confidence-calibration/build-calibration-report";
import { selectTrustworthyEvidenceTradeIds } from "@/lib/evidence-quality/build-evidence-quality";
import { applyIntegratedStrategyHealthSideEffects } from "./persist-strategy-health";
import type {
  IntegratedStrategyHealthBuildInput,
  IntegratedStrategyHealthSnapshot,
  StrategyRegistryHealthRecommendation,
} from "./types";
import {
  INTEGRATED_STRATEGY_HEALTH_LABEL,
  INTEGRATED_STRATEGY_HEALTH_MVP,
  STRATEGY_HEALTH_EVIDENCE_REQUIRED,
} from "./types";

export async function buildIntegratedStrategyHealth(
  input: IntegratedStrategyHealthBuildInput,
): Promise<IntegratedStrategyHealthSnapshot> {
  const evidenceQuality = input.evidenceQuality ?? null;
  const evidenceQualityBlocked = Boolean(
    evidenceQuality?.blocksStrategyHealthReview,
  );
  /** Allow new testnet entries while collecting valid evidence toward 12/12. */
  const evidenceCollectionInProgress = Boolean(
    evidenceQuality &&
      evidenceQuality.validEvidenceCount < STRATEGY_HEALTH_EVIDENCE_REQUIRED &&
      evidenceQuality.invalidEvidenceCount === 0,
  );
  const evidenceBlocksNewTestnetEntries =
    evidenceQualityBlocked && !evidenceCollectionInProgress;
  const evidenceQualityBlockReason = evidenceQualityBlocked
    ? evidenceQuality?.blockReason ??
      "Evidence quality poor — strategy health review blocked."
    : null;

  const trustworthyIds = evidenceQuality
    ? selectTrustworthyEvidenceTradeIds(evidenceQuality)
    : null;
  const evidenceValidTrades = trustworthyIds
    ? input.evidenceValidTrades.filter((t) => trustworthyIds.has(t.tradeId))
    : input.evidenceValidTrades;

  const qualityByDecision = new Map(
    (input.tradeQualityScores ?? []).map((s) => [s.decisionLogId, s]),
  );
  const calibrationByTag = input.confidenceCalibrationReport
    ? strategyCalibrationByTag(input.confidenceCalibrationReport)
    : new Map();

  const byTag = evidenceQualityBlocked
    ? new Map<string, typeof evidenceValidTrades>()
    : groupEvidenceTradesByStrategyTag(evidenceValidTrades);
  const reportsByTag = evidenceQualityBlocked
    ? []
    : [...byTag.entries()].map(([tag, trades]) =>
        buildStrategyHealthReportForTag({
          strategyTag: tag,
          trades,
          decisions: input.decisions,
          learningRecords: input.learningRecords,
          qualityByDecision,
          strategyCalibration: calibrationByTag.get(tag) ?? null,
        }),
      );

  const primaryReport = evidenceQualityBlocked
    ? null
    : selectPrimaryStrategyReport(reportsByTag);
  const evidenceReady =
    !evidenceQualityBlocked &&
    evidenceValidTrades.length >= STRATEGY_HEALTH_EVIDENCE_REQUIRED;

  let registryRecommendation: StrategyRegistryHealthRecommendation | null = null;
  let governanceWarningActive = false;

  if (
    !evidenceQualityBlocked &&
    input.persistSideEffects &&
    primaryReport &&
    primaryReport.evidenceCount >= STRATEGY_HEALTH_EVIDENCE_REQUIRED
  ) {
    const effects = await applyIntegratedStrategyHealthSideEffects({
      report: primaryReport,
    });
    if (effects.registryWritten && primaryReport) {
      registryRecommendation = {
        strategyTag: primaryReport.strategyTag,
        status: primaryReport.status,
        recommendation: primaryReport.recommendation,
        nextAction: primaryReport.nextAction,
        reportId: primaryReport.reportId,
        reviewedAt: primaryReport.reviewedAt,
        advisoryOnly: true,
      };
    }
    governanceWarningActive =
      effects.governanceCreated ||
      primaryReport.status === "PAUSE" ||
      primaryReport.status === "REJECT";
  } else if (primaryReport && !evidenceQualityBlocked) {
    governanceWarningActive =
      primaryReport.status === "PAUSE" || primaryReport.status === "REJECT";
    if (evidenceReady) {
      registryRecommendation = {
        strategyTag: primaryReport.strategyTag,
        status: primaryReport.status,
        recommendation: primaryReport.recommendation,
        nextAction: primaryReport.nextAction,
        reportId: primaryReport.reportId,
        reviewedAt: primaryReport.reviewedAt,
        advisoryOnly: true,
      };
    }
  }

  return {
    mvp: INTEGRATED_STRATEGY_HEALTH_MVP,
    label: INTEGRATED_STRATEGY_HEALTH_LABEL,
    evidenceRequired: STRATEGY_HEALTH_EVIDENCE_REQUIRED,
    evidenceReady,
    primaryReport,
    reportsByTag,
    registryRecommendation,
    agentScoreboardLearned: input.agentScoreboardLearned ?? 0,
    governanceWarningActive,
    blocksNewTestnetEntries:
      evidenceBlocksNewTestnetEntries ||
      blocksTestnetEntriesForHealth(primaryReport),
    autoStrategyChangeAllowed: false,
    liveTradingBlocked: true,
    confidenceOverconfidenceDetected:
      input.confidenceCalibrationReport?.overconfidenceDetected ?? false,
    confidenceAdjustmentRecommendation:
      input.confidenceCalibrationReport?.confidenceAdjustmentRecommendation ?? null,
    evidenceQualityBlocked,
    evidenceQualityBlockReason,
    lastUpdatedAt: new Date().toISOString(),
  };
}
