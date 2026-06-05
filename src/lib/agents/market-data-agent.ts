import type { AgentOutput } from "./types";
import {
  buildAgentOutput,
  type TradingDeskContext,
  withDeskMemoryReasons,
} from "./shared";

/** Market Data Agent — synthesizes Bybit tape + combination read (MVP 5). */
export function runMarketDataAgent(ctx: TradingDeskContext): AgentOutput {
  const { market, liquidation } = ctx.input;
  const combo = ctx.response.step4_combinationRead;
  const reasons: string[] = [];
  const risks: string[] = [];

  reasons.push(
    `BTC $${market.spotPrice.toLocaleString()} · 24h ${(market.priceChange24hPct ?? 0).toFixed(2)}%`,
  );
  reasons.push(`IV/HV ${market.ivHvRatio.toFixed(2)} · funding ${(market.fundingRate * 100).toFixed(3)}%`);

  if (market.oiChange24hPct != null) {
    reasons.push(`OI 24h ${market.oiChange24hPct >= 0 ? "+" : ""}${market.oiChange24hPct.toFixed(2)}%`);
  } else {
    risks.push("OI 24h missing — combination read partial.");
  }

  if (liquidation.liquidation24h != null) {
    reasons.push(`Liq 24h $${(liquidation.liquidation24h / 1e6).toFixed(1)}M`);
  }

  reasons.push(`Combination: ${combo.pattern.replace(/_/g, " ")} (${combo.dataStatus})`);

  if (ctx.ethQuote) {
    reasons.push(
      `ETH $${ctx.ethQuote.price.toLocaleString()} · 24h ${ctx.ethQuote.priceChange24hPct.toFixed(2)}%`,
    );
  }

  if (ctx.sourceErrors.length > 0) {
    risks.push(`${ctx.sourceErrors.length} data-source warning(s) on tape.`);
  }

  let recommendation: AgentOutput["recommendation"] = "WAIT";
  if (combo.dataStatus === "complete" && market.spotPrice > 0) {
    recommendation = combo.pattern === "long_capitulation" ? "SKIP" : "WAIT";
  }
  if (market.spotPrice <= 0) recommendation = "SKIP";

  return buildAgentOutput(
    {
      agentName: "Market Data Agent",
      strategyType: "RESEARCH",
      marketView: "Bybit public tape + combination read",
      recommendation,
      confidence: combo.dataStatus === "complete" ? 72 : 40,
      reasons: withDeskMemoryReasons(ctx, reasons, "Market Data Agent"),
      risks,
      proposedAction: "Feed desk with live derivatives context — no execution.",
    },
    ctx,
  );
}
