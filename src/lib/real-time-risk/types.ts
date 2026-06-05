import type { CommandCenterReport } from "@/lib/command-center/types";
import type { GovernanceDeskState, DeskIncident } from "@/lib/governance/governance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import type { PerpPaperPosition } from "@/lib/multi-asset/types";
import type { RegimeBrainResult } from "@/lib/market-regime-brain/types";
import type { UnifiedPortfolioSnapshot } from "@/lib/portfolio/unified-types";
import type { RiskBudgetResult } from "@/lib/risk-budget-optimizer/types";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type {
  ExchangeOpenOrderSnapshot,
  ExchangePositionSnapshot,
  ExchangeWalletSnapshot,
  OrderPreviewResult,
} from "@/lib/exchange/types";

export const REALTIME_RISK_SAFETY_NOTICE =
  "Real-time risk can block new trades and force reduce-only — it cannot increase risk or bypass governance.";

export type RealTimeRiskStatus = "SAFE" | "CAUTION" | "BLOCKED" | "EMERGENCY";

export type RiskCheckId =
  | "daily_loss_limit"
  | "weekly_loss_limit"
  | "max_notional_exposure"
  | "max_asset_exposure"
  | "max_strategy_exposure"
  | "max_correlated_exposure"
  | "margin_usage"
  | "liquidation_distance"
  | "volatility_shock"
  | "stale_market_data"
  | "open_order_mismatch"
  | "live_position_mismatch"
  | "unresolved_incident"
  | "governance_pause"
  | "kill_switch";

export interface RealTimeRiskCheck {
  id: RiskCheckId;
  label: string;
  status: "PASS" | "WARNING" | "FAIL" | "CRITICAL";
  message: string;
  blocking: boolean;
  limitId?: string;
}

export interface RealTimeRiskEvent {
  eventId: string;
  eventType: string;
  severity: "info" | "warning" | "critical";
  message: string;
  recordedAt: string;
  checkId?: RiskCheckId;
}

export interface RealTimeRiskReport {
  generatedAt: string;
  riskStatus: RealTimeRiskStatus;
  blockNewTrades: boolean;
  blockIncreaseExposure: boolean;
  reduceOnlyMode: boolean;
  recommendedActions: string[];
  riskEvents: RealTimeRiskEvent[];
  triggeredLimits: string[];
  checks: RealTimeRiskCheck[];
  metrics: {
    dailyPnlPct: number;
    weeklyPnlPct: number;
    totalNotionalUsd: number;
    marginUsagePct: number | null;
    minLiqDistancePct: number | null;
  };
  safetyNotice: string;
  cannotIncreaseRisk: true;
  cannotBypassGovernance: true;
}

export interface RealTimeRiskInput {
  entries: DecisionLogEntry[];
  orders: PaperOrder[];
  perpPositions?: PerpPaperPosition[];
  liveTrades?: LiveTradeJournalEntry[];
  exchangePositions?: ExchangePositionSnapshot[];
  openOrders?: ExchangeOpenOrderSnapshot[];
  wallet?: ExchangeWalletSnapshot | null;
  portfolio?: UnifiedPortfolioSnapshot | null;
  market?: AnalyzeApiResponse | null;
  regimeBrain?: RegimeBrainResult | null;
  governance?: GovernanceDeskState;
  incidents?: DeskIncident[];
  riskBudget?: RiskBudgetResult | null;
  commandCenter?: CommandCenterReport | null;
  emergencyStopActive?: boolean;
  dailyPnlPct?: number;
  weeklyPnlPct?: number;
  pilotDailyLossUsd?: number;
  pilotWeeklyLossUsd?: number;
}

export interface OrderRiskCheckInput {
  preview: OrderPreviewResult;
  report: RealTimeRiskReport;
  isCloseOrder?: boolean;
  increaseExposure?: boolean;
}

export interface OrderRiskCheckResult {
  allowed: boolean;
  blockers: string[];
  warnings: string[];
  reduceOnlyRequired: boolean;
  report: RealTimeRiskReport;
}

export type { OrderPreviewResult };
