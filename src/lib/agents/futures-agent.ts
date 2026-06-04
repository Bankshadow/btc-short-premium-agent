import type { AgentOutput } from "./types";
import {
  buildAgentOutput,
  formatProposedAction,
  getMissingDataLabels,
  withDeskMemoryReasons,
  type TradingDeskContext,
} from "./shared";

export function runFuturesStrategyAgent(ctx: TradingDeskContext): AgentOutput {
  const { market } = ctx.input;
  const combo = ctx.response.step4_combinationRead;
  const missing = getMissingDataLabels(ctx);
  const reasons: string[] = [];
  const risks: string[] = [];

  if (market.fundingRate !== 0) {
    reasons.push(`Funding ${(market.fundingRate * 100).toFixed(4)}%.`);
  }
  reasons.push(`Combination: ${combo.label}.`);

  let recommendation: AgentOutput["recommendation"] = "WAIT";
  let score = 50;
  let side = "none";

  if (missing.length > 0) {
    reasons.push("Missing data — no perp bias.");
  } else if (combo.pattern === "long_capitulation") {
    recommendation = "SKIP";
    score = 85;
    reasons.push("Long capitulation — no averaging down long perps.");
    risks.push("No futures average down in cascade regime.");
  } else if (combo.pattern === "new_shorts_piling") {
    recommendation = "TRADE";
    score = 72;
    side = "short";
    reasons.push("New shorts piling — tactical short perp with tight stop.");
  } else if (market.fundingRate < -0.0003) {
    recommendation = "TRADE";
    score = 65;
    side = "short";
    reasons.push("Negative funding — short perp carry edge (analysis only).");
  }

  if (
    dailyBearish(ctx) &&
    recommendation === "TRADE" &&
    side === "long"
  ) {
    recommendation = "SKIP";
    risks.push("No averaging down futures long into bearish structure.");
  }

  return buildAgentOutput(
    {
      agentName: "Futures Strategy Agent",
      strategyType: "FUTURES",
      marketView: `Perp desk · ${ctx.input.technical4h.trend}`,
      recommendation,
      confidence: score,
      reasons: withDeskMemoryReasons(ctx, reasons),
      risks,
      proposedAction: formatProposedAction({
        instrument: "BTCUSDT perp",
        side,
        sizePct: recommendation === "TRADE" ? 1 : 0,
        notes: "No auto execution — no DCA into losers.",
      }),
      missingData: missing,
    },
    ctx,
  );
}

function dailyBearish(ctx: TradingDeskContext): boolean {
  return ctx.input.technicalDaily.trend === "bearish";
}
