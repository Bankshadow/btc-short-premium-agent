import type { AgentOutput } from "./types";
import {
  buildAgentOutput,
  formatProposedAction,
  getMissingDataLabels,
  type TradingDeskContext,
} from "./shared";

/** Bull Thesis Agent — argues why the tape favors risk-taking (TradingAgents-style). */
export function runBullThesisAgent(ctx: TradingDeskContext): AgentOutput {
  const { market } = ctx.input;
  const daily = ctx.input.technicalDaily;
  const combo = ctx.response.step4_combinationRead;
  const missing = getMissingDataLabels(ctx);
  const reasons: string[] = [];
  const risks: string[] = [];

  if (daily.trend === "bullish") {
    reasons.push("Daily structure bullish — higher highs supported by EMA stack.");
  }
  if ((market.priceChange24hPct ?? 0) > 0) {
    reasons.push(`24h momentum positive (${market.priceChange24hPct?.toFixed(2)}%).`);
  }
  if (combo.pattern === "bullish_accumulation") {
    reasons.push("Bullish accumulation: OI up, price up — participation on the bid.");
  }
  if (market.ivHvRatio >= 1.15) {
    reasons.push(`IV/HV ${market.ivHvRatio.toFixed(2)} — premium selling has edge if disciplined.`);
  }
  if (market.fundingRate < 0) {
    reasons.push("Negative funding — shorts pay longs; favorable for cautious long/perp carry.");
  }

  if (missing.length > 0) {
    risks.push(`Cannot fully defend bull case — missing ${missing.join(", ")}.`);
  }
  if (combo.pattern === "long_capitulation") {
    risks.push("Capitulation regime — bull case weak until volatility settles.");
  }

  let recommendation: AgentOutput["recommendation"] = "WAIT";
  let score = 50;

  if (reasons.length >= 3 && missing.length === 0) {
    recommendation = "TRADE";
    score = 72;
  } else if (reasons.length >= 1) {
    recommendation = "WAIT";
    score = 55;
  } else {
    recommendation = "SKIP";
    score = 40;
    reasons.push("Insufficient bullish evidence for thesis.");
  }

  return buildAgentOutput(
    {
      agentName: "Bull Thesis Agent",
      strategyType: "THESIS",
      marketView: "Constructive / risk-on bias",
      recommendation,
      confidence: score,
      reasons,
      risks,
      proposedAction: formatProposedAction({
        instrument: "Bull thesis",
        notes:
          recommendation === "TRADE"
            ? "Favor defined-risk long premium or spot adds on dips — human approval only."
            : "Monitor for bull confirmation before sizing.",
      }),
      missingData: missing,
    },
    ctx,
  );
}
