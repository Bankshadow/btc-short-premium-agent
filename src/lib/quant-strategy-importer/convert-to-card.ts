import { buildAiReviewSummary } from "./build-ai-review";
import { QUANT_CATALOG_IMPORTED_AT, type StrategySeedDefinition } from "./seed-strategies";
import type { ImportedStrategyCard, QuantImportStatus } from "./types";

export function convertSeedToCard(
  seed: StrategySeedDefinition,
  statusOverride?: QuantImportStatus,
  lastReviewedAt?: string | null,
): ImportedStrategyCard {
  const importStatus = statusOverride ?? seed.importStatus;
  const thesis = seed.thesis;
  const aiReviewSummary = buildAiReviewSummary(seed, {
    thesis,
    marketRegimeFit: seed.marketRegimeFit,
    cryptoAdaptationNotes: seed.cryptoAdaptationNotes,
    suggestedUse: seed.suggestedUse,
  });

  return {
    sourceId: seed.sourceId,
    sourceUrl: seed.sourceUrl,
    repoName: seed.repoName,
    strategyName: seed.strategyName,
    category: seed.category,
    description: seed.description,
    originalAssumptions: seed.originalAssumptions,
    riskNotes: seed.riskNotes,
    importStatus,
    thesis,
    marketRegimeFit: seed.marketRegimeFit,
    cryptoAdaptationNotes: seed.cryptoAdaptationNotes,
    requiredData: seed.requiredData,
    riskWarning: seed.riskWarning,
    suggestedUse: seed.suggestedUse,
    aiReviewSummary,
    importedAt: QUANT_CATALOG_IMPORTED_AT,
    lastReviewedAt: lastReviewedAt ?? null,
    humanApprovalRequired: true,
    executionBlocked: true,
  };
}
