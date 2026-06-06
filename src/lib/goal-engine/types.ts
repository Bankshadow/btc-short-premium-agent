import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { UnifiedPortfolioSnapshot } from "@/lib/portfolio/unified-types";
import type { TestnetMonitorSnapshot } from "@/lib/testnet-monitor/types";
import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";

export type GoalEnvironment = "PAPER" | "SHADOW" | "TESTNET" | "LIVE";

/** Default combined scope never mixes LIVE or DEMO data. */
export type GoalScope = "PAPER_TESTNET_COMBINED" | "PAPER" | "TESTNET" | "LIVE";

export type AIActivityStatus =
  | "IDLE"
  | "ANALYZING"
  | "MONITORING"
  | "IN_TRADE"
  | "WAITING"
  | "BLOCKED";

export interface ProfitMission {
  startCapital: number;
  targetCapital: number;
  currentEquity: number;
  netPnl: number;
  progressPct: number;
  remainingToTarget: number;
  targetMultiple: number;
  currentMultiple: number;
  updatedAt: string;
}

export interface TradeStatsSnapshot {
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  breakevenTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  currentStreak: number;
  bestTrade: number;
  worstTrade: number;
}

export interface EquitySnapshot {
  scopeLabel: string;
  startCapital: number;
  currentEquity: number;
  realizedPnl: number;
  unrealizedPnl: number;
  netPnl: number;
  openExposureUsd: number;
  updatedAt: string;
}

export interface CurrentPositionSummary {
  environment: GoalEnvironment;
  symbol: string;
  side: string;
  entryPrice: number;
  markPrice: number | null;
  unrealizedPnlUsd: number;
  openedAt: string | null;
  durationLabel: string | null;
  canCloseOnTestnet: boolean;
}

export interface PrimaryCta {
  label: string;
  href: string;
  description: string;
}

export interface AIActivitySnapshot {
  status: AIActivityStatus;
  lastAction: string;
  currentPositionSummary: string;
  nextPlannedAction: string;
  humanActionRequired: boolean;
  reason: string;
  updatedAt: string;
}

export type UserActionSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface UserActionItem {
  id: string;
  title: string;
  detail: string;
  severity: UserActionSeverity;
  href: string | null;
}

export interface UserActionRequired {
  required: boolean;
  items: UserActionItem[];
}

export interface GoalEnvironmentBreakdown {
  environment: GoalEnvironment;
  tradeStats: TradeStatsSnapshot;
  equity: EquitySnapshot;
}

export interface GoalRiskSummary {
  dailyLossStatus: string;
  dailyLossLimitLabel: string;
  openRiskUsd: number;
  liveLocked: boolean;
  testnetStatus: string;
  blocker: string | null;
}

export interface GoalProgressSnapshot {
  generatedAt: string;
  scope: GoalScope;
  scopeLabel: string;
  mission: ProfitMission;
  tradeStats: TradeStatsSnapshot;
  equity: EquitySnapshot;
  aiActivity: AIActivitySnapshot;
  userActionRequired: UserActionRequired;
  currentPosition: CurrentPositionSummary | null;
  risk: GoalRiskSummary;
  byEnvironment: Record<GoalEnvironment, GoalEnvironmentBreakdown>;
  /** Alias for byEnvironment — per-environment breakdown. */
  environmentBreakdown: Record<GoalEnvironment, GoalEnvironmentBreakdown>;
  /** LIVE is always reported separately and never folded into the mission. */
  live: GoalEnvironmentBreakdown;
  minTradesForTrust: number;
  trustReady: boolean;
  dataConnected: boolean;
  zeroStateMessage: string | null;
  primaryCta: PrimaryCta;
  currentStrategy: string | null;
  lastCycleAt: string | null;
  lastVerdict: string | null;
}

export interface GoalEngineInput {
  startCapital?: number;
  targetCapital?: number;
  minTradesForTrust?: number;
  entries: DecisionLogEntry[];
  orders: PaperOrder[];
  unifiedPortfolio?: UnifiedPortfolioSnapshot | null;
  testnetSnapshot?: TestnetMonitorSnapshot | null;
  liveTrades?: LiveTradeJournalEntry[];
  ai?: {
    automationEnabled?: boolean;
    automationPaused?: boolean;
    lastRunStatus?: string | null;
    lastRunAt?: string | null;
    lastVerdict?: string | null;
    commandCenterStatus?: string | null;
    riskBlocked?: boolean;
    blockerReason?: string | null;
    nextRunAt?: string | null;
  };
  risk?: {
    dailyLossStatus?: string;
    dailyLossLimitLabel?: string;
    liveLocked?: boolean;
    blocker?: string | null;
    testnetConfigured?: boolean;
    testnetConnected?: boolean;
  };
  learning?: {
    pendingReview?: number;
    learnedCount?: number;
  };
}

export const GOAL_START_CAPITAL = 1_000;
export const GOAL_TARGET_CAPITAL = 10_000;
export const GOAL_MIN_TRADES_FOR_TRUST = 12;
