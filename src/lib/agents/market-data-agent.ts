import type { AgentOutput } from "@/lib/types/agent";
import {
  buildAgentOutput,
  emptyAction,
  getMissingDataLabels,
  trendToMarketView,
  type TradingDeskContext,
} from "./shared";

export function runMarketDataAgent(ctx: TradingDeskContext): AgentOutput {
  const { market } = ctx.input;
  const missing = getMissingDataLabels(ctx);
  const daily = ctx.input.technicalDaily;
  const reasons: string[] = [];
  const risks: string[] = [];

  if (market.spotPrice > 0) {
    reasons.push(
      `BTC spot ${market.spotPrice.toLocaleString("en-US")} (${market.priceChange24hPct?.toFixed(2) ?? "n/a"}% 24h).`,
    );
  } else {
    risks.push("BTC spot price unavailable.");
  }

  if (market.ivHvRatio > 0) {
    reasons.push(`IV/HV ratio ${market.ivHvRatio.toFixed(2)}.`);
  }
  if (ctx.input.liquidation.liquidation24h != null) {
    reasons.push(
      `Liquidation 24h $${(ctx.input.liquidation.liquidation24h / 1e6).toFixed(1)}M.`,
    );
  } else {
    risks.push("Liquidation 24h not provided — use manual override.");
  }

  for (const err of ctx.sourceErrors.slice(0, 3)) {
    risks.push(`${err.source}: ${err.message}`);
  }

  const recommendation =
    missing.length > 0 ? "WAIT" : market.spotPrice <= 0 ? "SKIP" : "WAIT";

  if (missing.length > 0) {
    reasons.push(`Missing required fields: ${missing.join(", ")}.`);
  }

  return buildAgentOutput({
    agentName: "Market Data Agent",
    strategyType: "market_data",
    marketView: trendToMarketView(daily.trend),
    recommendation,
    confidence: missing.length > 0 ? 40 : 85,
    reasons,
    risks,
    proposedAction: emptyAction(
      "Data feed only — no trade. Confirm overrides before strategy agents vote.",
    ),
  });
}
