import { runDataQualityAgent, scoreDataQuality } from "@/lib/agents/data-quality-agent";
import { runMacroNewsAgent } from "@/lib/agents/macro-news-agent";
import { runMarketDataAgent } from "@/lib/agents/market-data-agent";
import { resolveRegimeLabel, runRegimeAgent } from "@/lib/agents/regime-agent";
import type { TradingDeskContext } from "@/lib/agents/shared";
import { computeEthCorrelation } from "./eth-correlation";
import type { ResearchBrief, ResearchLayerInput } from "./research-types";

export function runResearchLayer(
  ctx: TradingDeskContext,
  input: ResearchLayerInput = {},
): ResearchBrief {
  const ethCtx: TradingDeskContext = {
    ...ctx,
    ethQuote: input.ethQuote ?? ctx.ethQuote,
  };

  const regimeLabel = resolveRegimeLabel(ethCtx);
  const ethCorrelation = computeEthCorrelation(
    ethCtx.input.market.priceChange24hPct,
    input.ethQuote ?? ethCtx.ethQuote,
  );

  const marketData = runMarketDataAgent(ethCtx);
  const regime = runRegimeAgent(ethCtx, regimeLabel);
  const dataQuality = runDataQualityAgent(ethCtx);
  const macroNews = runMacroNewsAgent(ethCtx);

  const summaryBullets: string[] = [
    regimeLabel,
    `Data quality ${scoreDataQuality(ethCtx)}/100`,
    ethCorrelation.summary,
    marketData.reasons[0] ?? "",
    macroNews.reasons[0] ?? "",
  ].filter((b) => b.length > 0);

  const agents = [marketData, regime, dataQuality, macroNews];

  return {
    generatedAt: ctx.response.step5_verdict.analyzedAt,
    regimeLabel,
    dataQualityScore: scoreDataQuality(ethCtx),
    ethCorrelation,
    marketData,
    regime,
    dataQuality,
    macroNews,
    agents,
    summaryBullets,
  };
}
