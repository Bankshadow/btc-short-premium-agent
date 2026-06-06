import { convertSeedToCard } from "./convert-to-card";
import { loadImportStatusOverrides } from "./importer-store";
import { QUANT_STRATEGY_SEEDS } from "./seed-strategies";
import type { QuantImporterCatalog, QuantImportStatus } from "./types";
import {
  QUANT_IMPORT_SAFETY_NOTICE,
  QUANT_SOURCE_BASE_URL,
  QUANT_SOURCE_REPO,
} from "./types";

function countByStatus(
  strategies: QuantImporterCatalog["strategies"],
): Record<QuantImportStatus, number> {
  return {
    RESEARCH_ONLY: strategies.filter((s) => s.importStatus === "RESEARCH_ONLY").length,
    READY_FOR_BACKTEST: strategies.filter((s) => s.importStatus === "READY_FOR_BACKTEST")
      .length,
    READY_FOR_PAPER: strategies.filter((s) => s.importStatus === "READY_FOR_PAPER").length,
    REJECTED: strategies.filter((s) => s.importStatus === "REJECTED").length,
  };
}

export async function buildQuantImporterCatalog(): Promise<QuantImporterCatalog> {
  const overrides = await loadImportStatusOverrides();
  const strategies = QUANT_STRATEGY_SEEDS.map((seed) => {
    const override = overrides[seed.sourceId];
    return convertSeedToCard(
      seed,
      override?.importStatus,
      override?.lastReviewedAt ?? null,
    );
  });

  return {
    generatedAt: new Date().toISOString(),
    sourceRepo: QUANT_SOURCE_REPO,
    sourceUrl: QUANT_SOURCE_BASE_URL,
    analysisOnly: true,
    noLiveExecution: true,
    noAutoTrading: true,
    safetyNotice: QUANT_IMPORT_SAFETY_NOTICE,
    strategies,
    statusCounts: countByStatus(strategies),
  };
}

export function getSeedById(sourceId: string) {
  return QUANT_STRATEGY_SEEDS.find((s) => s.sourceId === sourceId) ?? null;
}
