import { buildQuantImporterCatalog } from "@/lib/quant-strategy-importer/build-catalog";
import { computeStrategyMetrics, evaluatePromotionEligibility } from "@/lib/strategy-shadow/compute-metrics";
import { loadShadowTrades } from "@/lib/strategy-shadow/shadow-store";
import { deriveGarageStage, nextGarageAction } from "./evaluate-stage";
import { classifyStrategyRisk } from "./risk-classify";
import {
  loadAllGarageRecords,
  loadCustomStrategies,
  loadGarageBacktestSummaries,
} from "./garage-store";
import { buildBacktestUrl, buildShadowUrl } from "./config";
import type {
  GarageShadowSummary,
  StrategyGarageCard,
  StrategyGarageCatalog,
  StrategyGarageStage,
} from "./types";
import { STRATEGY_GARAGE_SAFETY_NOTICE } from "./types";

function countStages(cards: StrategyGarageCard[]): Record<StrategyGarageStage, number> {
  const counts: Record<StrategyGarageStage, number> = {
    IMPORTED: 0,
    AI_REVIEWED: 0,
    BACKTEST_READY: 0,
    SHADOW_TESTING: 0,
    TESTNET_READY: 0,
    APPROVED_FOR_USE: 0,
    REJECTED: 0,
  };
  for (const c of cards) counts[c.stage] += 1;
  return counts;
}

export async function buildStrategyGarageCatalog(): Promise<StrategyGarageCatalog> {
  const [quantCatalog, records, custom, backtests, shadowTrades] = await Promise.all([
    buildQuantImporterCatalog(),
    loadAllGarageRecords(),
    loadCustomStrategies(),
    loadGarageBacktestSummaries(),
    loadShadowTrades(),
  ]);

  const cards: StrategyGarageCard[] = [];

  for (const q of quantCatalog.strategies) {
    const record = records[q.sourceId] ?? null;
    const backtest = record?.lastBacktest ?? backtests[q.sourceId] ?? null;
    const metrics = computeStrategyMetrics(shadowTrades, q.sourceId);
    let shadow: GarageShadowSummary | null = null;
    if (metrics) {
      const elig = evaluatePromotionEligibility(metrics);
      shadow = {
        closedTrades: metrics.closedTrades,
        winRate: metrics.winRate,
        shadowPnL: metrics.shadowPnL,
        eligibleForPromotion: elig.eligible,
        blockers: elig.blockers,
      };
    }
    const stage = deriveGarageStage({
      record,
      importStatus: q.importStatus,
      shadow,
    });
    const riskClass =
      record?.riskClass ??
      classifyStrategyRisk({
        suggestedUse: q.suggestedUse,
        riskNotes: q.riskNotes,
        riskWarning: q.riskWarning,
        lastBacktest: backtest,
      });

    cards.push({
      sourceId: q.sourceId,
      strategyName: q.strategyName,
      category: q.category,
      description: q.description,
      sourceUrl: q.sourceUrl,
      importSource: "quant_seed",
      stage,
      riskClass,
      suggestedUse: q.suggestedUse,
      aiReviewSummary: record?.aiReviewSummary ?? q.aiReviewSummary,
      thesis: q.thesis,
      importStatus: q.importStatus,
      approvedForAiLoop: record?.approvedForAiLoop ?? false,
      humanApprovalRequired: true,
      executionBlocked: true,
      lastBacktest: backtest,
      lastShadow: shadow,
      backtestUrl: buildBacktestUrl(q.sourceId),
      shadowUrl: buildShadowUrl(q.sourceId),
      canPromote: stage !== "REJECTED" && stage !== "APPROVED_FOR_USE",
      canReject: stage !== "REJECTED",
      canApproveForAiLoop: stage === "TESTNET_READY" && !(record?.approvedForAiLoop ?? false),
      nextAction: nextGarageAction(stage),
    });
  }

  for (const customStrategy of custom) {
    const record = records[customStrategy.sourceId] ?? null;
    const backtest = record?.lastBacktest ?? backtests[customStrategy.sourceId] ?? null;
    const metrics = computeStrategyMetrics(shadowTrades, customStrategy.sourceId);
    let shadow: GarageShadowSummary | null = null;
    if (metrics) {
      const elig = evaluatePromotionEligibility(metrics);
      shadow = {
        closedTrades: metrics.closedTrades,
        winRate: metrics.winRate,
        shadowPnL: metrics.shadowPnL,
        eligibleForPromotion: elig.eligible,
        blockers: elig.blockers,
      };
    }
    const importStatus = record?.importStatus ?? "RESEARCH_ONLY";
    const stage = deriveGarageStage({ record, importStatus, shadow });
    const riskClass =
      record?.riskClass ??
      classifyStrategyRisk({
        suggestedUse: customStrategy.suggestedUse,
        riskNotes: customStrategy.riskNotes,
        riskWarning: customStrategy.riskWarning,
        lastBacktest: backtest,
      });

    cards.push({
      sourceId: customStrategy.sourceId,
      strategyName: customStrategy.strategyName,
      category: customStrategy.category,
      description: customStrategy.description,
      sourceUrl: customStrategy.sourceUrl,
      importSource: customStrategy.importSource,
      stage,
      riskClass,
      suggestedUse: customStrategy.suggestedUse,
      aiReviewSummary: record?.aiReviewSummary ?? null,
      thesis: customStrategy.thesis,
      importStatus,
      approvedForAiLoop: record?.approvedForAiLoop ?? false,
      humanApprovalRequired: true,
      executionBlocked: true,
      lastBacktest: backtest,
      lastShadow: shadow,
      backtestUrl: buildBacktestUrl(customStrategy.sourceId),
      shadowUrl: buildShadowUrl(customStrategy.sourceId),
      canPromote: stage !== "REJECTED" && stage !== "APPROVED_FOR_USE",
      canReject: stage !== "REJECTED",
      canApproveForAiLoop: stage === "TESTNET_READY" && !(record?.approvedForAiLoop ?? false),
      nextAction: nextGarageAction(stage),
    });
  }

  cards.sort((a, b) => a.strategyName.localeCompare(b.strategyName));

  return {
    generatedAt: new Date().toISOString(),
    safetyNotice: STRATEGY_GARAGE_SAFETY_NOTICE,
    analysisOnly: true,
    noDirectExecution: true,
    humanApprovalRequiredForAiLoop: true,
    strategies: cards,
    stageCounts: countStages(cards),
  };
}

export async function getGarageCard(sourceId: string): Promise<StrategyGarageCard | null> {
  const catalog = await buildStrategyGarageCatalog();
  return catalog.strategies.find((s) => s.sourceId === sourceId) ?? null;
}
