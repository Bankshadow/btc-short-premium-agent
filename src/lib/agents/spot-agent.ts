import type { AgentOutput } from "./types";
import {
  buildAgentOutput,
  fromEngineRecommendation,
  getMissingDataLabels,
  trendToMarketView,
  type TradingDeskContext,
} from "./shared";

export function runSpotStrategyAgent(ctx: TradingDeskContext): AgentOutput {
  const daily = ctx.input.technicalDaily;
  const h4 = ctx.input.technical4h;
  const macroView = ctx.input.macroView ?? "neutral";
  const missing = getMissingDataLabels(ctx);
  const reasons: string[] = [];
  const risks: string[] = [];

  reasons.push(`Daily trend: ${daily.trend}; 4h trend: ${h4.trend}.`);
  reasons.push(`Macro bias: ${macroView}.`);

  if (daily.rsi14 > 70) risks.push("RSI overbought on daily — spot chase risk.");
  if (daily.rsi14 < 30) risks.push("RSI oversold — spot dip may continue.");

  let recommendation: AgentOutput["recommendation"] = "WAIT";
  let confidence = 55;

  if (missing.length > 0) {
    reasons.push("Incomplete market data — spot desk waits.");
  } else if (macroView === "bearish" && daily.trend === "bearish") {
    recommendation = "WAIT";
    confidence = 65;
    reasons.push("Bearish macro + trend — no spot long; watch bounce entries only.");
  } else if (macroView === "bullish" && daily.trend === "bullish") {
    recommendation = "TRADE";
    confidence = 70;
    reasons.push("Aligned bullish spot — tactical long bias on dips to EMA20.");
  } else if (daily.trend === "neutral") {
    recommendation = "WAIT";
    confidence = 50;
    reasons.push("Neutral trend — spot desk prefers range edges.");
  } else {
    recommendation = "SKIP";
    confidence = 60;
    reasons.push("Macro vs technical conflict — spot desk stands aside.");
  }

  if (ctx.input.macroEvent.hasEventBeforeSettlement) {
    recommendation = "SKIP";
    confidence = 90;
    reasons.push("High-impact macro — spot size zero.");
  }

  const engine = fromEngineRecommendation(
    ctx.response.step5_verdict.recommendation,
    ctx.response.step5_verdict.confidence,
  );
  if (engine.recommendation === "SKIP" && recommendation === "TRADE") {
    recommendation = "WAIT";
    reasons.push("Options desk SKIP — spot will not front-run committee.");
  }

  return buildAgentOutput(
    {
      agentName: "Spot Strategy Agent",
      strategyType: "SPOT",
      marketView: trendToMarketView(daily.trend),
      recommendation,
      confidence,
      reasons,
      risks,
      proposedAction: {
        instrument: "BTC spot (hypothetical)",
        side:
          recommendation === "TRADE" && macroView === "bullish"
            ? "long"
            : "none",
        sizePct: recommendation === "TRADE" ? 1 : 0,
        notes: "Hypothetical spot plan — human approval required.",
      },
      missingData: missing,
    },
    ctx,
  );
}
