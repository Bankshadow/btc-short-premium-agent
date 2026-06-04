import type { AgentOutput } from "./types";
import { isAggressiveDeskRisk } from "@/lib/desk/desk-risk-policy";
import {
  buildAgentOutput,
  formatProposedAction,
  fromEngineRecommendation,
  getMissingDataLabels,
  withDeskMemoryReasons,
  type TradingDeskContext,
} from "./shared";
import { tradeRecToAgent } from "./types";

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
    if (isAggressiveDeskRisk()) {
      recommendation = "TRADE";
      score = 62;
      reasons.push("Bearish tape — spot desk aligns with short-premium playbook.");
    } else {
      recommendation = "WAIT";
      score = 60;
      reasons.push("Bearish tape — no spot long; cash is a position.");
    }
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
  const playbookRec = tradeRecToAgent(ctx.response.step5_verdict.recommendation);
  if (engine.recommendation === "SKIP" && recommendation === "TRADE") {
    recommendation = isAggressiveDeskRisk() && playbookRec === "TRADE" ? "TRADE" : "WAIT";
    reasons.push(
      isAggressiveDeskRisk() && playbookRec === "TRADE"
        ? "Playbook TRADE — spot desk follows aggressive policy."
        : "Options playbook SKIP — spot defers.",
    );
  }

  return buildAgentOutput(
    {
      agentName: "Spot Strategy Agent",
      strategyType: "SPOT",
      marketView: `Spot desk · ${daily.trend}`,
      recommendation,
      confidence: score,
      reasons: withDeskMemoryReasons(ctx, reasons),
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
