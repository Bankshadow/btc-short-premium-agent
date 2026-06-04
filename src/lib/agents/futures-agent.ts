import type { AgentOutput } from "@/lib/types/agent";
import {
  buildAgentOutput,
  getMissingDataLabels,
  trendToMarketView,
  type TradingDeskContext,
} from "./shared";

export function runFuturesStrategyAgent(ctx: TradingDeskContext): AgentOutput {
  const { market } = ctx.input;
  const combo = ctx.response.step4_combinationRead;
  const missing = getMissingDataLabels(ctx);
  const reasons: string[] = [];
  const risks: string[] = [];

  if (market.fundingRate !== 0) {
    reasons.push(`Funding ${(market.fundingRate * 100).toFixed(4)}% per interval.`);
  }
  if (market.oiChange24hPct != null) {
    reasons.push(`OI 24h ${market.oiChange24hPct.toFixed(2)}%.`);
  } else {
    risks.push("OI 24h change missing — futures read is partial.");
  }

  reasons.push(`Combination: ${combo.label} (${combo.pattern}).`);

  let recommendation: AgentOutput["recommendation"] = "WAIT";
  let confidence = 50;
  let side: "long" | "short" | "neutral" | "none" = "none";

  if (missing.length > 0) {
    recommendation = "WAIT";
    reasons.push("Missing data — no perp bias.");
  } else if (combo.pattern === "long_capitulation") {
    recommendation = "SKIP";
    confidence = 85;
    side = "short";
    reasons.push("Long capitulation — avoid new short perps into squeeze.");
  } else if (combo.pattern === "new_shorts_piling") {
    recommendation = "TRADE";
    confidence = 72;
    side = "short";
    reasons.push("New shorts piling — tactical short perp bias with tight risk.");
  } else if (combo.pattern === "bullish_accumulation") {
    recommendation = "WAIT";
    confidence = 60;
    reasons.push("Bullish accumulation — futures desk waits for funding fade.");
  } else if (market.fundingRate < -0.0003) {
    recommendation = "TRADE";
    confidence = 68;
    side = "short";
    reasons.push("Negative funding supports short-perp carry (analysis only).");
  } else {
    recommendation = "WAIT";
    reasons.push("No clear perp edge — stand aside.");
  }

  if (market.fundingRate > 0.0001 && side === "short") {
    risks.push("Positive funding — short perp pays carry cost.");
  }

  return buildAgentOutput({
    agentName: "Futures Strategy Agent",
    strategyType: "futures",
    marketView: trendToMarketView(ctx.input.technical4h.trend),
    recommendation,
    confidence,
    reasons,
    risks,
    proposedAction: {
      instrument: "BTCUSDT perpetual (hypothetical)",
      side,
      sizePct: recommendation === "TRADE" ? 1.25 : 0,
      notes: "Perp plan for analysis — no order routing.",
    },
  });
}
