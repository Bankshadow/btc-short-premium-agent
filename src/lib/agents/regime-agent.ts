import type { AgentOutput, MarketRegimeLabel, MarketRegimeSnapshot } from "./types";
import { REGIME_LABELS } from "./types";
import { LIQUIDATION_SKIP } from "@/lib/decision/thresholds";
import {
  buildAgentOutput,
  getMissingDataLabels,
  type TradingDeskContext,
} from "./shared";

function classifyRegime(ctx: TradingDeskContext): {
  label: MarketRegimeLabel;
  description: string;
} {
  const { market, liquidation, macroEvent } = ctx.input;
  const daily = ctx.input.technicalDaily;
  const combo = ctx.response.step4_combinationRead;
  const liq = liquidation.liquidation24h;

  if (macroEvent.hasEventBeforeSettlement) {
    return {
      label: "macro_caution",
      description: "High-impact macro before settlement — reduce risk or stand aside.",
    };
  }

  if (liq != null && liq > LIQUIDATION_SKIP) {
    return {
      label: "liquidation_stress",
      description: "Liquidation cascade regime — short premium and leverage discouraged.",
    };
  }

  if (combo.pattern === "long_capitulation") {
    return {
      label: "liquidation_stress",
      description: "Long capitulation pattern — volatile two-way risk.",
    };
  }

  if (daily.trend === "bullish" && (market.priceChange24hPct ?? 0) > 0) {
    return {
      label: "risk_on_trend",
      description: "Bullish structure with positive 24h momentum — risk-on bias.",
    };
  }

  if (daily.trend === "bearish" && (market.priceChange24hPct ?? 0) < 0) {
    return {
      label: "risk_off_trend",
      description: "Bearish structure with negative momentum — risk-off bias.",
    };
  }

  if (daily.trend === "neutral" || combo.pattern === "quiet_deleveraging") {
    return {
      label: "range_bound",
      description: "Neutral / quiet tape — range and premium selling favored over trend chase.",
    };
  }

  if (getMissingDataLabels(ctx).length > 0) {
    return {
      label: "unclear",
      description: "Incomplete data — regime classification low confidence.",
    };
  }

  return {
    label: "unclear",
    description: "Mixed signals — wait for clearer regime before sizing.",
  };
}

export function runRegimeAgent(ctx: TradingDeskContext): MarketRegimeSnapshot {
  const { label, description } = classifyRegime(ctx);
  const missing = getMissingDataLabels(ctx);

  const recommendation: AgentOutput["recommendation"] =
    label === "liquidation_stress" || label === "macro_caution"
      ? "SKIP"
      : label === "unclear"
        ? "WAIT"
        : "WAIT";

  const agent = buildAgentOutput(
    {
      agentName: "Regime Agent",
      strategyType: "REGIME",
      marketView:
        label === "risk_on_trend"
          ? "bullish"
          : label === "risk_off_trend"
            ? "bearish"
            : "neutral",
      recommendation,
      confidence: missing.length > 0 ? 45 : 78,
      reasons: [
        `Regime: ${REGIME_LABELS[label]}.`,
        description,
        `Combination: ${ctx.response.step4_combinationRead.label}.`,
      ],
      risks: missing.length > 0 ? [`Missing: ${missing.join(", ")}`] : [],
      proposedAction: {
        instrument: "regime filter",
        side: "neutral",
        sizePct: 0,
        notes: "Regime sets context for spot / futures / options agents.",
      },
      missingData: missing,
    },
    ctx,
  );

  return {
    label,
    title: REGIME_LABELS[label],
    description,
    agent,
  };
}
