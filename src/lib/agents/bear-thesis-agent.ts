import type { AgentOutput } from "./types";
import {
  buildAgentOutput,
  formatProposedAction,
  getMissingDataLabels,
  withDeskMemoryReasons,
  type TradingDeskContext,
} from "./shared";
import { LIQUIDATION_SKIP } from "@/lib/decision/thresholds";
import { bearSkipReasonThreshold } from "@/lib/desk/desk-risk-policy";

/** Bear Thesis Agent — argues why the tape is dangerous (TradingAgents-style). */
export function runBearThesisAgent(ctx: TradingDeskContext): AgentOutput {
  const { market, liquidation, macroEvent } = ctx.input;
  const daily = ctx.input.technicalDaily;
  const combo = ctx.response.step4_combinationRead;
  const missing = getMissingDataLabels(ctx);
  const reasons: string[] = [];
  const risks: string[] = [];

  if (daily.trend === "bearish") {
    reasons.push("Daily trend bearish — rallies are sold.");
  }
  if ((market.priceChange24hPct ?? 0) < 0) {
    reasons.push(`24h return negative (${market.priceChange24hPct?.toFixed(2)}%).`);
  }
  const liq = liquidation.liquidation24h;
  if (liq != null && liq > LIQUIDATION_SKIP) {
    reasons.push(`Liquidation 24h $${(liq / 1e6).toFixed(0)}M — cascade / pain trade risk.`);
  }
  if (combo.pattern === "long_capitulation" || combo.pattern === "new_shorts_piling") {
    reasons.push(`Combination ${combo.label} — asymmetric downside / squeeze risk.`);
  }
  if (macroEvent.hasEventBeforeSettlement) {
    reasons.push("High-impact macro before settlement — gap and vol risk.");
  }
  if (market.ivHvRatio > 0 && market.ivHvRatio < 1.15) {
    reasons.push("IV/HV below 1.15 — short premium structurally unattractive.");
  }

  let recommendation: AgentOutput["recommendation"] = "WAIT";
  let score = 55;

  if (reasons.length >= bearSkipReasonThreshold()) {
    recommendation = "SKIP";
    score = 80;
  } else if (reasons.length >= 1) {
    recommendation = "WAIT";
    score = 60;
  }

  if (missing.length > 0) {
    risks.push("Bear case under-informed until data complete.");
  }

  return buildAgentOutput(
    {
      agentName: "Bear Thesis Agent",
      strategyType: "THESIS",
      marketView: "Defensive / risk-off bias",
      recommendation,
      confidence: score,
      reasons: withDeskMemoryReasons(ctx, reasons),
      risks,
      proposedAction: formatProposedAction({
        instrument: "Bear thesis",
        notes:
          recommendation === "SKIP"
            ? "Stand aside or hedge — do not add short premium into stress."
            : "Reduce size and widen margins until bear drivers fade.",
      }),
      missingData: missing,
    },
    ctx,
  );
}
