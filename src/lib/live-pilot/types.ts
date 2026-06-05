import type { PerpDirectionalSignal } from "@/lib/multi-asset/types";
import type { OrderPreviewResult } from "@/lib/exchange/types";
import type { GovernanceDeskState, DeskIncident } from "@/lib/governance/governance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";

export type LivePilotMode =
  | "LIVE_DISABLED"
  | "LIVE_TESTNET"
  | "LIVE_SMALL_PILOT"
  | "LIVE_FULL_DISABLED_BY_DEFAULT";

export interface LivePilotRiskConfig {
  pilotEnabled: boolean;
  pilotMaxNotionalUsd: number;
  liveMaxNotionalUsd: number;
  dailyTradeLimit: number;
  dailyLossLimitUsd: number;
  weeklyLossLimitUsd: number;
  cooldownMinutesAfterLoss: number;
  allowedSymbols: string[] | null;
  emergencyStopEnv: boolean;
  requireDoubleConfirm: boolean;
  liveExecutionEnabled: boolean;
  network: "testnet" | "mainnet" | null;
}

export type LiveTradeStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "EXECUTED"
  | "OPEN"
  | "CLOSED"
  | "FAILED"
  | "BLOCKED"
  | "CANCELLED";

export interface LiveTradeEntrySnapshot {
  price: number;
  qty: number;
  notionalUsd: number;
  side: string;
  symbol: string;
  timestamp: string;
}

export interface LiveTradeExitSnapshot {
  price: number;
  qty: number;
  notionalUsd: number;
  side: string;
  timestamp: string;
  reduceOnly: true;
}

export interface LiveTradeJournalEntry {
  liveTradeId: string;
  sourceSignalId: string | null;
  decisionLogId: string | null;
  previewId: string;
  confirmTokenId: string;
  exchangeOrderId: string | null;
  status: LiveTradeStatus;
  symbol: string;
  side: string;
  entry: LiveTradeEntrySnapshot | null;
  exit: LiveTradeExitSnapshot | null;
  realizedPnl: number | null;
  fees: number | null;
  slippage: number | null;
  operatorApproval: boolean;
  operatorApprovalNote: string | null;
  createdAt: string;
  executedAt: string | null;
  closedAt: string | null;
  error: string | null;
  pilotMode: LivePilotMode;
}

export interface PilotPreviewQueueItem {
  previewId: string;
  signal: PerpDirectionalSignal;
  preview: OrderPreviewResult;
  sourceSignalId: string | null;
  decisionLogId: string | null;
  createdAt: string;
  status: "QUEUED" | "APPROVED" | "EXECUTED" | "EXPIRED" | "REJECTED";
  operatorApprovalNote: string | null;
}

export interface PilotDailyMetrics {
  tradesToday: number;
  realizedPnlTodayUsd: number;
  realizedPnlWeekUsd: number;
  lastLossAt: string | null;
  inCooldown: boolean;
  cooldownUntil: string | null;
  dailyLossLimitUsd: number;
  dailyTradeLimit: number;
  weeklyLossLimitUsd: number;
  dailyLossUsedPct: number;
}

export interface PilotGuardInput {
  preview: OrderPreviewResult;
  journal: LiveTradeJournalEntry[];
  config: LivePilotRiskConfig;
  mode: LivePilotMode;
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
  governance?: GovernanceDeskState;
  incidents?: DeskIncident[];
  readinessStatus?: "PASS" | "WARNING" | "FAIL";
  emergencyStopActive?: boolean;
  operatorApproval?: boolean;
  doubleConfirm?: boolean;
  isCloseOrder?: boolean;
  riskBudget?: import("@/lib/risk-budget-optimizer/types").RiskBudgetResult | null;
  realTimeRiskReport?: import("@/lib/real-time-risk/types").RealTimeRiskReport;
  perpPositions?: import("@/lib/multi-asset/types").PerpPaperPosition[];
  portfolio?: import("@/lib/portfolio/unified-types").UnifiedPortfolioSnapshot | null;
  market?: import("@/lib/types/market").AnalyzeApiResponse | null;
  regimeBrain?: import("@/lib/market-regime-brain/types").RegimeBrainResult | null;
  commandCenter?: import("@/lib/command-center/types").CommandCenterReport | null;
  scaleStage?: import("@/lib/live-scale-up/types").LiveScaleStage;
}

export interface PilotGuardResult {
  allowed: boolean;
  blockers: string[];
  warnings: string[];
}

export interface PilotStatusSnapshot {
  mode: LivePilotMode;
  config: LivePilotRiskConfig;
  metrics: PilotDailyMetrics;
  emergencyStopActive: boolean;
  btcOptionsLiveSupported: false;
  safetyNotice: string;
  openTrades: LiveTradeJournalEntry[];
  closedTrades: LiveTradeJournalEntry[];
  effectiveMaxNotionalUsd: number;
  executionAllowed: boolean;
}
