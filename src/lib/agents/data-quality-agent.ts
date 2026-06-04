import type { AgentOutput } from "./types";
import {
  buildAgentOutput,
  CRITICAL_DATA_FIELDS,
  getMissingDataLabels,
  type TradingDeskContext,
  withDeskMemoryReasons,
} from "./shared";

export function scoreDataQuality(ctx: TradingDeskContext): number {
  const missing = getMissingDataLabels(ctx);
  const total = CRITICAL_DATA_FIELDS.length;
  const penalty = missing.length * (100 / total);
  const errorPenalty = Math.min(30, ctx.sourceErrors.length * 8);
  const comboPenalty =
    ctx.response.step4_combinationRead.dataStatus === "partial_data" ? 15 : 0;
  return Math.max(0, Math.round(100 - penalty - errorPenalty - comboPenalty));
}

/** Data Quality Agent — flags incomplete tape before committee (MVP 5). */
export function runDataQualityAgent(ctx: TradingDeskContext): AgentOutput {
  const score = scoreDataQuality(ctx);
  const missing = getMissingDataLabels(ctx);
  const reasons: string[] = [`Data quality score: ${score}/100`];

  if (missing.length > 0) {
    reasons.push(`Missing: ${missing.join(", ")}`);
  } else {
    reasons.push("All critical BTC derivatives fields present.");
  }

  if (ctx.sourceErrors.length > 0) {
    reasons.push(
      `Source issues: ${ctx.sourceErrors.slice(0, 2).map((e) => e.source).join(", ")}`,
    );
  }

  const risks: string[] = [];
  if (score < 50) {
    risks.push("Low quality — committee should prefer WAIT over TRADE.");
  }

  let recommendation: AgentOutput["recommendation"] = "WAIT";
  let confidence = score;
  if (score < 35 || missing.length >= 3) {
    recommendation = "SKIP";
    confidence = 85;
  } else if (score >= 70) {
    recommendation = "WAIT";
    confidence = 65;
  }

  return buildAgentOutput(
    {
      agentName: "Data Quality Agent",
      strategyType: "RESEARCH",
      marketView: `Tape completeness · ${score}/100`,
      recommendation,
      confidence,
      reasons: withDeskMemoryReasons(ctx, reasons),
      risks,
      proposedAction:
        score < 50
          ? "Fill manual overrides or wait for complete Bybit fetch."
          : "Quality sufficient for committee debate.",
      missingData: missing,
    },
    ctx,
  );
}
