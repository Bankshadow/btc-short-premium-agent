import { buildQuantImporterCatalog } from "@/lib/quant-strategy-importer/build-catalog";
import { loadShadowTrades } from "./shadow-store";
import {
  buildAiTradeComparison,
  computeStrategyMetrics,
  evaluatePromotionEligibility,
} from "./compute-metrics";
import type {
  ShadowPromotionCandidate,
  StrategyShadowReport,
} from "./types";
import {
  AI_COMMITTEE_SOURCE_ID,
  SHADOW_PROMOTION_RULES,
  STRATEGY_SHADOW_SAFETY_NOTICE,
} from "./types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";

export async function buildStrategyShadowReport(input?: {
  symbol?: "BTCUSDT" | "SOLUSDT";
  lookbackDays?: number;
  aiPaperOrders?: PaperOrder[];
}): Promise<StrategyShadowReport> {
  const symbol = input?.symbol ?? "BTCUSDT";
  const lookbackDays = input?.lookbackDays ?? 90;
  const trades = await loadShadowTrades();
  const symbolTrades = trades.filter((t) => t.symbol === symbol || t.symbol === "BTCUSDT");

  const sourceIds = [...new Set(symbolTrades.map((t) => t.sourceId))];
  const byStrategy = sourceIds
    .map((id) => computeStrategyMetrics(symbolTrades, id))
    .filter((m): m is NonNullable<typeof m> => m !== null)
    .filter((m) => m.sourceType === "quant_import");

  const aiCommittee = computeStrategyMetrics(symbolTrades, AI_COMMITTEE_SOURCE_ID);
  const comparison = buildAiTradeComparison({
    shadowTrades: symbolTrades,
    aiTrades: input?.aiPaperOrders ?? [],
    quantMetrics: byStrategy,
  });

  const catalog = await buildQuantImporterCatalog();
  const promotionCandidates: ShadowPromotionCandidate[] = [];

  for (const metrics of byStrategy) {
    const card = catalog.strategies.find((s) => s.sourceId === metrics.sourceId);
    const { eligible, blockers } = evaluatePromotionEligibility(metrics);
    promotionCandidates.push({
      sourceId: metrics.sourceId,
      strategyName: metrics.strategyName,
      importStatus: card?.importStatus ?? "RESEARCH_ONLY",
      metrics,
      eligible,
      blockers,
      humanApprovalRequired: true,
      cannotCountAsLiveProof: true,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    symbol,
    lookbackDays,
    trades: symbolTrades,
    byStrategy,
    aiCommittee,
    comparison,
    promotionCandidates,
    safetyNotice: `${STRATEGY_SHADOW_SAFETY_NOTICE} Promotion requires min ${SHADOW_PROMOTION_RULES.minSampleSize} samples, max ${SHADOW_PROMOTION_RULES.maxDrawdownPct}% drawdown, and human approval.`,
    neverPlacesOrders: true,
    cannotCountAsLiveProof: true,
  };
}
