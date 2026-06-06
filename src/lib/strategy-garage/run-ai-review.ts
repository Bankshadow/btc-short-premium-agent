import { buildAiReviewSummary } from "@/lib/quant-strategy-importer/build-ai-review";
import { getSeedById } from "@/lib/quant-strategy-importer/build-catalog";
import { loadCustomStrategies, upsertGarageRecord } from "./garage-store";
import { classifyStrategyRisk } from "./risk-classify";
import { getGarageCard } from "./build-garage-catalog";

export async function runGarageAiReview(sourceId: string): Promise<{
  ok: boolean;
  summary: string | null;
  message: string;
}> {
  const seed = getSeedById(sourceId);
  const custom = (await loadCustomStrategies()).find((s) => s.sourceId === sourceId);
  if (!seed && !custom) {
    return { ok: false, summary: null, message: `Unknown strategy: ${sourceId}` };
  }

  const card = await getGarageCard(sourceId);
  const backtest = card?.lastBacktest ?? null;

  const summary = seed
    ? buildAiReviewSummary(seed, {
        thesis: seed.thesis,
        marketRegimeFit: seed.marketRegimeFit,
        cryptoAdaptationNotes: seed.cryptoAdaptationNotes,
        suggestedUse: seed.suggestedUse,
      })
    : buildAiReviewSummary(
        {
          sourceId: custom!.sourceId,
          sourceUrl: custom!.sourceUrl,
          repoName: custom!.repoName,
          strategyName: custom!.strategyName,
          category: custom!.category,
          description: custom!.description,
          originalAssumptions: custom!.originalAssumptions,
          riskNotes: custom!.riskNotes,
          importStatus: "RESEARCH_ONLY",
        },
        {
          thesis: custom!.thesis,
          marketRegimeFit: custom!.marketRegimeFit,
          cryptoAdaptationNotes: custom!.cryptoAdaptationNotes,
          suggestedUse: custom!.suggestedUse,
        },
      );

  const riskClass = classifyStrategyRisk({
    suggestedUse: seed?.suggestedUse ?? custom!.suggestedUse,
    riskNotes: seed?.riskNotes ?? custom!.riskNotes,
    riskWarning: seed?.riskWarning ?? custom!.riskWarning,
    lastBacktest: backtest,
  });

  await upsertGarageRecord(sourceId, {
    stage: "AI_REVIEWED",
    aiReviewSummary: summary,
    aiReviewedAt: new Date().toISOString(),
    riskClass,
    importSource: seed ? "quant_seed" : custom!.importSource,
  });

  return {
    ok: true,
    summary,
    message: "AI review complete — advisory summary stored. No execution enabled.",
  };
}
