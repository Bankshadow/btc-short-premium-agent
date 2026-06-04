import type { AgentOutput } from "./types";
import {
  buildAgentOutput,
  formatProposedAction,
  fromEngineRecommendation,
  getMissingDataLabels,
  type TradingDeskContext,
} from "./shared";

export function runSpotStrategyAgent(ctx: TradingDeskContext): AgentOutput {
  const daily = ctx.input.technicalDaily;
  const macroView = ctx.input.macroView ?? "neutral";
  const missing = getMissingDataLabels(ctx);
  const reasons: string[] = [];
  const risks: string[] = [];

  reasons.push(`Daily ${daily.trend}; macro ${macroView}.`);

  let recommendation: AgentOutput["recommendation"] = "WAIT";
  let score = 50;

  if (missing.length > 0) {
    reasons.push("Incomplete data — spot desk waits.");
  } else if (macroView === "bullish" && daily.trend === "bullish") {
    recommendation = "TRADE";
    score = 70;
    reasons.push("Aligned bullish — tactical spot long on dips only.");
  } else if (macroView === "bearish" && daily.trend === "bearish") {
    recommendation = "WAIT";
    score = 60;
    reasons.push("Bearish tape — no spot long; cash is a position.");
  } else {
    recommendation = "SKIP";
    score = 55;
    reasons.push("Conflicted signals — spot desk stands aside.");
  }

  if (ctx.input.macroEvent.hasEventBeforeSettlement) {
    recommendation = "SKIP";
    score = 90;
  }

  const engine = fromEngineRecommendation(
    ctx.response.step5_verdict.recommendation,
    ctx.response.step5_verdict.confidence,
  );
  if (engine.recommendation === "SKIP" && recommendation === "TRADE") {
    recommendation = "WAIT";
    reasons.push("Options playbook SKIP — spot defers.");
  }

  return buildAgentOutput(
    {
      agentName: "Spot Strategy Agent",
      strategyType: "SPOT",
      marketView: `Spot desk · ${daily.trend}`,
      recommendation,
      confidence: score,
      reasons,
      risks,
      proposedAction: formatProposedAction({
        instrument: "BTC spot",
        side: recommendation === "TRADE" ? "long" : "none",
        sizePct: recommendation === "TRADE" ? 1 : 0,
        notes: "Hypothetical — human approval required.",
      }),
      missingData: missing,
    },
    ctx,
  );
}
