import { isAggressiveDeskRisk } from "@/lib/desk/desk-risk-policy";
import {
  scoreTechnicalSnapshotForHorizon,
  TIMEFRAME_HORIZON_CONFIG,
} from "@/lib/multi-asset/timeframe-chart-logic";
import type { TimeframeHorizon } from "@/lib/multi-asset/timeframe-types";
import type { TechnicalSnapshot } from "@/lib/types/market";
import type { AgentOutput } from "./types";
import {
  buildAgentOutput,
  formatProposedAction,
  getMissingDataLabels,
  withDeskMemoryReasons,
  type TradingDeskContext,
} from "./shared";

function runChartAgentForHorizon(
  ctx: TradingDeskContext,
  snapshot: TechnicalSnapshot,
  horizon: TimeframeHorizon,
  agentName: string,
): AgentOutput {
  const cfg = TIMEFRAME_HORIZON_CONFIG[horizon];
  const missing = getMissingDataLabels(ctx);
  const { score, direction, confidence, recommendationScore } =
    scoreTechnicalSnapshotForHorizon(snapshot, horizon);

  const reasons: string[] = [
    `${cfg.label}: ${snapshot.trend} · RSI ${snapshot.rsi14} · MACD hist ${snapshot.macdHistogram.toFixed(2)}`,
    `Chart score ${score} (${direction})`,
  ];
  const risks: string[] = [];

  let recommendation: AgentOutput["recommendation"] = "WAIT";
  let side = "none";

  if (missing.length > 0) {
    reasons.push("Missing tape — chart agent waits.");
  } else if (direction === "LONG") {
    recommendation = "TRADE";
    side = "long";
    reasons.push(`${cfg.label} bullish setup — tactical long perp.`);
  } else if (direction === "SHORT") {
    recommendation = "TRADE";
    side = "short";
    reasons.push(`${cfg.label} bearish setup — tactical short perp.`);
  } else if (
    isAggressiveDeskRisk() &&
    Math.abs(score) >= cfg.actionableScore - 8
  ) {
    recommendation = "TRADE";
    side = score >= 0 ? "long" : "short";
    reasons.push(
      `Aggressive desk — marginal ${cfg.label} bias (${score}).`,
    );
    risks.push("Lower conviction chart read — size down.");
  } else {
    reasons.push(`${cfg.label} no clear edge — wait for setup.`);
  }

  if (
    ctx.input.technicalDaily.trend === "bearish" &&
    recommendation === "TRADE" &&
    side === "long" &&
    horizon !== "SHORT"
  ) {
    recommendation = "WAIT";
    risks.push("Daily bearish — no swing/long longs without 1H confirmation.");
  }

  return buildAgentOutput(
    {
      agentName,
      strategyType: "FUTURES",
      marketView: `${cfg.label} · ${snapshot.trend}`,
      recommendation,
      confidence: recommendationScore,
      reasons: withDeskMemoryReasons(ctx, reasons),
      risks,
      proposedAction: formatProposedAction({
        instrument: `${snapshot.symbol} perp (${cfg.label})`,
        side,
        sizePct: recommendation === "TRADE" ? (confidence === "HIGH" ? 1.2 : 0.8) : 0,
        notes: "Timeframe chart agent — testnet autopilot may stack when aligned.",
      }),
      missingData: missing,
    },
    ctx,
  );
}

export function runShortChartAgent(ctx: TradingDeskContext): AgentOutput {
  return runChartAgentForHorizon(
    ctx,
    ctx.input.technical1h,
    "SHORT",
    "Short-Chart Agent (1H)",
  );
}

export function runMediumChartAgent(ctx: TradingDeskContext): AgentOutput {
  return runChartAgentForHorizon(
    ctx,
    ctx.input.technical4h,
    "MEDIUM",
    "Medium-Chart Agent (4H)",
  );
}

export function runLongChartAgent(ctx: TradingDeskContext): AgentOutput {
  return runChartAgentForHorizon(
    ctx,
    ctx.input.technicalDaily,
    "LONG",
    "Long-Chart Agent (1D)",
  );
}
