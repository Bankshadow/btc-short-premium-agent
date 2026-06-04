import { STRATEGY_LABELS } from "@/lib/validation/validation-config";
import type { StrategyId } from "@/lib/validation/validation-types";
import type {
  StrategyProductType,
  StrategyRegistryStatus,
  StrategyRiskLevel,
} from "./strategy-registry-types";
import type { CanonicalRegime } from "@/lib/validation/validation-types";

export interface StrategySeedConfig {
  id: StrategyId;
  name: string;
  version: string;
  productType: StrategyProductType;
  allowedRegimes: CanonicalRegime[];
  riskLevel: StrategyRiskLevel;
  requiredData: string[];
  ownerAgent: string;
  defaultStatus: StrategyRegistryStatus;
}

export const STRATEGY_REGISTRY_SEEDS: StrategySeedConfig[] = [
  {
    id: "options_short_premium",
    name: STRATEGY_LABELS.options_short_premium,
    version: "1.0.0",
    productType: "OPTIONS",
    allowedRegimes: [
      "quiet_range",
      "bear_trend",
      "post_cascade",
      "mixed_unclear",
    ],
    riskLevel: "MEDIUM",
    requiredData: [
      "Bybit option chain",
      "IV/HV ratio",
      "Funding rate",
      "Liquidation 24h",
    ],
    ownerAgent: "Options Strategy Agent",
    defaultStatus: "ACTIVE",
  },
  {
    id: "spot",
    name: STRATEGY_LABELS.spot,
    version: "1.0.0",
    productType: "SPOT",
    allowedRegimes: ["bull_trend", "mixed_unclear"],
    riskLevel: "LOW",
    requiredData: ["BTC spot", "4H support/resistance"],
    ownerAgent: "Spot Strategy Agent",
    defaultStatus: "WATCHLIST",
  },
  {
    id: "futures_long",
    name: STRATEGY_LABELS.futures_long,
    version: "1.0.0",
    productType: "FUTURES",
    allowedRegimes: ["bull_trend", "mixed_unclear"],
    riskLevel: "HIGH",
    requiredData: ["Perp funding", "OI change", "4H trend"],
    ownerAgent: "Futures Strategy Agent",
    defaultStatus: "WATCHLIST",
  },
  {
    id: "futures_short",
    name: STRATEGY_LABELS.futures_short,
    version: "1.0.0",
    productType: "FUTURES",
    allowedRegimes: ["bear_trend", "mixed_unclear"],
    riskLevel: "HIGH",
    requiredData: ["Perp funding", "OI change", "Liquidation map"],
    ownerAgent: "Futures Strategy Agent",
    defaultStatus: "WATCHLIST",
  },
  {
    id: "eth_btc",
    name: STRATEGY_LABELS.eth_btc,
    version: "1.0.0",
    productType: "PORTFOLIO",
    allowedRegimes: ["bull_trend", "bear_trend", "quiet_range"],
    riskLevel: "MEDIUM",
    requiredData: ["ETH/USDT spot", "BTC correlation read"],
    ownerAgent: "Market Data Agent",
    defaultStatus: "DRAFT",
  },
  {
    id: "aggressive_risk_mode",
    name: STRATEGY_LABELS.aggressive_risk_mode,
    version: "1.0.0",
    productType: "PORTFOLIO",
    allowedRegimes: [
      "quiet_range",
      "bull_trend",
      "bear_trend",
      "mixed_unclear",
    ],
    riskLevel: "AGGRESSIVE",
    requiredData: ["Desk risk profile aggressive", "Playbook TRADE signal"],
    ownerAgent: "Risk Manager Agent",
    defaultStatus: "PAPER_TESTING",
  },
];

export const AGENT_TO_STRATEGY_IDS: Record<string, StrategyId[]> = {
  "Options Strategy Agent": ["options_short_premium"],
  "Spot Strategy Agent": ["spot"],
  "Futures Strategy Agent": ["futures_long", "futures_short"],
  "Market Data Agent": ["eth_btc"],
};
