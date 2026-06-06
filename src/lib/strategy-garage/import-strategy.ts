import { buildAiReviewSummary } from "@/lib/quant-strategy-importer/build-ai-review";
import type { StrategySource } from "@/lib/quant-strategy-importer/types";
import { classifyStrategyRisk } from "./risk-classify";
import { saveCustomStrategy, upsertGarageRecord } from "./garage-store";
import type { GarageCustomStrategy, ImportGarageStrategyInput } from "./types";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function parseGithubRepo(url: string): string | null {
  const match = url.match(/github\.com\/([^/]+\/[^/]+)/i);
  return match?.[1] ?? null;
}

export async function importGarageStrategy(
  input: ImportGarageStrategyInput,
): Promise<GarageCustomStrategy> {
  const slug = slugify(input.strategyName) || "strategy";
  const sourceId = `custom-${slug}-${Date.now().toString(36).slice(2, 6)}`;
  const repoName =
    input.importSource === "github" && input.sourceUrl
      ? (parseGithubRepo(input.sourceUrl) ?? "external/github")
      : input.importSource === "link"
        ? "external/link"
        : "manual/description";

  const strategy: GarageCustomStrategy = {
    sourceId,
    sourceUrl: input.sourceUrl?.trim() || `manual://${sourceId}`,
    repoName,
    strategyName: input.strategyName.trim(),
    category: input.category?.trim() || "Custom import",
    description: input.description.trim(),
    thesis:
      input.thesis?.trim() ||
      `Evaluate ${input.strategyName} for BTC/SOL perp adaptation before any paper use.`,
    originalAssumptions: ["Imported via Strategy Garage — assumptions unverified."],
    riskNotes: input.riskNotes?.length
      ? input.riskNotes
      : ["Unvalidated external logic — treat as high research risk until backtested."],
    marketRegimeFit: ["mixed_unclear"],
    cryptoAdaptationNotes: [
      "Re-tune parameters on 4H BTCUSDT/SOLUSDT before shadow or testnet trial.",
    ],
    requiredData: ["4H klines", "Funding rate"],
    riskWarning: "Custom import cannot execute until full garage pipeline + human approval.",
    suggestedUse: "RESEARCH_ONLY",
    importSource: input.importSource,
    importedAt: new Date().toISOString(),
  };

  await saveCustomStrategy(strategy);

  const source: StrategySource = {
    sourceId: strategy.sourceId,
    sourceUrl: strategy.sourceUrl,
    repoName: strategy.repoName,
    strategyName: strategy.strategyName,
    category: strategy.category,
    description: strategy.description,
    originalAssumptions: strategy.originalAssumptions,
    riskNotes: strategy.riskNotes,
    importStatus: "RESEARCH_ONLY",
  };

  const aiReviewSummary = buildAiReviewSummary(source, {
    thesis: strategy.thesis,
    marketRegimeFit: strategy.marketRegimeFit,
    cryptoAdaptationNotes: strategy.cryptoAdaptationNotes,
    suggestedUse: strategy.suggestedUse,
  });

  const riskClass = classifyStrategyRisk({
    suggestedUse: strategy.suggestedUse,
    riskNotes: strategy.riskNotes,
    riskWarning: strategy.riskWarning,
  });

  await upsertGarageRecord(sourceId, {
    stage: "AI_REVIEWED",
    importSource: input.importSource,
    riskClass,
    aiReviewSummary,
    aiReviewedAt: new Date().toISOString(),
    importStatus: "RESEARCH_ONLY",
  });

  return strategy;
}
