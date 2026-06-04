import type { AgentRecommendation } from "@/lib/agents/types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";

export type StrategyId =
  | "options_short_premium"
  | "spot"
  | "futures_long"
  | "futures_short"
  | "eth_btc"
  | "aggressive_risk_mode";

export type StrategyStatus =
  | "ACTIVE"
  | "WATCHLIST"
  | "PAPER_ONLY"
  | "DISABLED"
  | "EXPERIMENTAL";

export type CanonicalRegime =
  | "quiet_range"
  | "bull_trend"
  | "bear_trend"
  | "high_vol_cascade"
  | "post_cascade"
  | "macro_risk_day"
  | "mixed_unclear";

export interface StrategyPerformanceRow {
  id: StrategyId;
  label: string;
  status: StrategyStatus;
  totalSignals: number;
  resolvedSignals: number;
  winRate: number;
  averageR: number;
  profitFactor: number;
  maxDrawdownPct: number;
  falsePositives: number;
  falseNegatives: number;
  correctSkips: number;
  bestRegime: string;
  worstRegime: string;
  promotionReason: string;
}

export interface AgentValidationRow {
  agentName: string;
  strategyId: StrategyId | "desk";
  status: StrategyStatus;
  totalCalls: number;
  winRate: number;
  averageR: number;
  maxDrawdownPct: number;
  promotionReason: string;
}

export interface RegimePerformanceRow {
  regime: CanonicalRegime;
  label: string;
  sessions: number;
  resolved: number;
  winRate: number;
  netPnlPct: number;
  allowedStrategies: StrategyId[];
  routerNote: string;
}

export interface CapitalAllocationRecommendation {
  reservePct: number;
  coreStrategyPct: number;
  growthStrategyPct: number;
  experimentalPct: number;
  aggressiveModeAllowed: boolean;
  summary: string;
  coreStrategies: StrategyId[];
  growthStrategies: StrategyId[];
}

export type KillSwitchReason =
  | "daily_loss_limit"
  | "weekly_loss_limit"
  | "max_drawdown"
  | "loss_streak_cooldown"
  | "data_quality_lockout"
  | "aggressive_mode_lockout"
  | "operator_pause";

export interface KillSwitchStatus {
  tradingPaused: boolean;
  aggressiveBlocked: boolean;
  activeReasons: KillSwitchReason[];
  cooldownUntil: string | null;
  dailyPnlPct: number;
  weeklyPnlPct: number;
  peakToTroughDrawdownPct: number;
  consecutiveLosses: number;
  dataQualityScore: number | null;
  messages: string[];
}

export interface ValidationActionItem {
  kind: "disable" | "scale" | "watch";
  target: string;
  reason: string;
  priority: "high" | "medium" | "low";
}

export interface ValidationReport {
  generatedAt: string;
  strategyMatrix: StrategyPerformanceRow[];
  agentBoard: AgentValidationRow[];
  regimePerformance: RegimePerformanceRow[];
  capitalAllocation: CapitalAllocationRecommendation;
  killSwitch: KillSwitchStatus;
  recentOverrides: Array<{
    logEntryId: string;
    verdict: AgentRecommendation;
    reason: string;
    createdAt: string;
  }>;
  disableNext: ValidationActionItem[];
  scaleNext: ValidationActionItem[];
  currentRegime: CanonicalRegime;
  currentRegimeLabel: string;
  riskProfile: DeskRiskProfile;
}
