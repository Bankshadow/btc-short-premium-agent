import type { ExchangePositionSnapshot, ExchangeStatusResult } from "@/lib/exchange/types";
import type { GovernanceDeskState } from "@/lib/governance/governance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import type { RegimeBrainResult } from "@/lib/market-regime-brain/types";
import type { RiskBudgetResult } from "@/lib/risk-budget-optimizer/types";
import type { DataConfidenceResult } from "@/lib/data-trust/types";
import type { MarketSnapshot } from "@/lib/types/market";

export const LIVE_SUPERVISOR_SAFETY_NOTICE =
  "Live Trade Supervisor monitors open positions and recommends actions only. No automatic close by default. Cannot open positions or increase exposure. Human approval required for all actions.";

export type SupervisorAction =
  | "HOLD"
  | "REDUCE"
  | "CLOSE"
  | "HEDGE"
  | "REVIEW_REQUIRED"
  | "EMERGENCY_BLOCK";

export interface SupervisorAlert {
  id: string;
  severity: "info" | "warning" | "critical";
  category: string;
  message: string;
}

export interface ThesisValidity {
  score: number;
  valid: boolean;
  originalRegime: string;
  currentRegime: string;
  reasons: string[];
}

export interface PositionHealth {
  liveTradeId: string;
  symbol: string;
  side: string;
  entryPrice: number;
  markPrice: number;
  unrealizedPnlUsd: number;
  unrealizedPnlPct: number;
  notionalUsd: number;
  stopLoss: number | null;
  takeProfit: number | null;
  stopLossProximityPct: number | null;
  takeProfitReached: boolean;
  healthScore: number;
}

export interface SupervisorPositionReport {
  liveTradeId: string;
  journalEntry: LiveTradeJournalEntry;
  decisionLogEntry: DecisionLogEntry | null;
  health: PositionHealth;
  thesis: ThesisValidity;
  recommendation: SupervisorAction;
  confidence: number;
  alerts: SupervisorAlert[];
  rationale: string[];
  requiresHumanApproval: true;
  canIncreaseExposure: false;
  canOpenNewPosition: false;
}

export interface ClosePreviewRequest {
  liveTradeId: string;
  mode: "full_close" | "partial_close";
  partialPct?: number;
}

export interface SupervisorClosePreview {
  previewId: string;
  liveTradeId: string;
  mode: "full_close" | "partial_close";
  symbol: string;
  positionSide: "Buy" | "Sell";
  qty: number;
  estExitPrice: number;
  estNotionalUsd: number;
  reduceOnly: true;
  requiresHumanApproval: true;
  disclaimer: string;
}

export interface SupervisorJournalEntry {
  id: string;
  timestamp: string;
  liveTradeId: string;
  action: SupervisorAction;
  operatorDecision: "ACCEPTED" | "REJECTED" | "DEFERRED" | "PENDING";
  operatorNote: string;
  recommendationSnapshot: SupervisorAction;
  alerts: string[];
}

export interface LiveSupervisorReport {
  generatedAt: string;
  openPositionCount: number;
  positions: SupervisorPositionReport[];
  aggregateRecommendation: SupervisorAction;
  riskAlerts: SupervisorAlert[];
  exchangeConnected: boolean;
  governancePaused: boolean;
  emergencyStopActive: boolean;
  autoCloseEnabled: false;
  safetyNotice: string;
}

export interface LiveSupervisorInput {
  openTrades: LiveTradeJournalEntry[];
  exchangeStatus?: ExchangeStatusResult | null;
  entries?: DecisionLogEntry[];
  market?: MarketSnapshot | null;
  regimeBrain?: RegimeBrainResult | null;
  riskBudget?: RiskBudgetResult | null;
  dataTrust?: DataConfidenceResult | null;
  governance?: GovernanceDeskState | null;
  emergencyStopActive?: boolean;
  entryFundingRate?: number | null;
  entryLiquidation24h?: number | null;
}

export interface SupervisorConfig {
  autoCloseEnabled: false;
  emergencyAutoCloseEnabled: false;
  pollIntervalHintMs: number;
}

export const DEFAULT_SUPERVISOR_CONFIG: SupervisorConfig = {
  autoCloseEnabled: false,
  emergencyAutoCloseEnabled: false,
  pollIntervalHintMs: 60_000,
};

export function mapExchangePosition(
  pos: ExchangePositionSnapshot,
): Partial<PositionHealth> {
  return {
    symbol: pos.symbol,
    side: pos.side,
    markPrice: pos.markPrice,
    unrealizedPnlUsd: pos.unrealisedPnl,
    notionalUsd: pos.positionValueUsd,
  };
}
