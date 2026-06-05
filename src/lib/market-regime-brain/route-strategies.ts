import type { StrategyId } from "@/lib/validation/validation-types";
import type { RegimeTaxonomy, TradeFrequencyRecommendation } from "./types";

const ALL_STRATEGIES: StrategyId[] = [
  "options_short_premium",
  "spot",
  "futures_long",
  "futures_short",
  "eth_btc",
];

export interface RegimeRouting {
  recommended: StrategyId[];
  blocked: StrategyId[];
  sizingMultiplier: number;
  tradeFrequency: TradeFrequencyRecommendation;
}

const ROUTING: Record<RegimeTaxonomy, RegimeRouting> = {
  BULL_TREND: {
    recommended: ["spot", "futures_long", "eth_btc"],
    blocked: ["futures_short"],
    sizingMultiplier: 1,
    tradeFrequency: "NORMAL",
  },
  BEAR_TREND: {
    recommended: ["futures_short", "options_short_premium"],
    blocked: ["spot", "futures_long"],
    sizingMultiplier: 1,
    tradeFrequency: "NORMAL",
  },
  SIDEWAYS: {
    recommended: ["options_short_premium"],
    blocked: ["futures_long", "futures_short"],
    sizingMultiplier: 0.85,
    tradeFrequency: "REDUCE",
  },
  HIGH_VOLATILITY: {
    recommended: [],
    blocked: ALL_STRATEGIES,
    sizingMultiplier: 0,
    tradeFrequency: "PAUSE",
  },
  LOW_VOLATILITY: {
    recommended: ["options_short_premium"],
    blocked: ["futures_long", "futures_short"],
    sizingMultiplier: 0.9,
    tradeFrequency: "REDUCE",
  },
  VOL_EXPANSION: {
    recommended: ["options_short_premium"],
    blocked: ["spot", "futures_long", "futures_short"],
    sizingMultiplier: 0.5,
    tradeFrequency: "REDUCE",
  },
  VOL_COMPRESSION: {
    recommended: ["options_short_premium"],
    blocked: [],
    sizingMultiplier: 1,
    tradeFrequency: "NORMAL",
  },
  LIQUIDATION_RISK: {
    recommended: [],
    blocked: ALL_STRATEGIES,
    sizingMultiplier: 0,
    tradeFrequency: "PAUSE",
  },
  MACRO_EVENT_RISK: {
    recommended: [],
    blocked: ALL_STRATEGIES,
    sizingMultiplier: 0,
    tradeFrequency: "PAUSE",
  },
  BREAKOUT_RISK: {
    recommended: ["futures_long", "futures_short", "spot"],
    blocked: ["options_short_premium"],
    sizingMultiplier: 0.6,
    tradeFrequency: "REDUCE",
  },
  RANGE_BOUND_PREMIUM_SELLING: {
    recommended: ["options_short_premium"],
    blocked: ["futures_long", "futures_short"],
    sizingMultiplier: 1,
    tradeFrequency: "NORMAL",
  },
};

export function routeStrategiesForRegime(
  primary: RegimeTaxonomy,
): RegimeRouting {
  return ROUTING[primary];
}

export function taxonomyToDeskLabel(taxonomy: RegimeTaxonomy): string {
  const map: Record<RegimeTaxonomy, string> = {
    BULL_TREND: "Risk-on trend",
    BEAR_TREND: "Risk-off trend",
    SIDEWAYS: "Range-bound",
    HIGH_VOLATILITY: "High volatility stress",
    LOW_VOLATILITY: "Low volatility range",
    VOL_EXPANSION: "Vol expansion",
    VOL_COMPRESSION: "Vol compression",
    LIQUIDATION_RISK: "Liquidation stress",
    MACRO_EVENT_RISK: "Macro caution",
    BREAKOUT_RISK: "Breakout risk",
    RANGE_BOUND_PREMIUM_SELLING: "Range-bound premium selling",
  };
  return map[taxonomy];
}
