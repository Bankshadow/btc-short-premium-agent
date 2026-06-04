import type { HypotheticalAction } from "@/lib/types/market";
import type { StrategyId } from "@/lib/validation/validation-types";

export type ExecutionMode =
  | "COPY_ONLY"
  | "PAPER_EXECUTE"
  | "MANUAL_APPROVED_LIVE_PLACEHOLDER";

export type TradeControlActionType =
  | "APPROVE"
  | "REJECT"
  | "MODIFY"
  | "PAPER_ONLY";

export type TradeControlStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "MODIFIED"
  | "PAPER_ONLY"
  | "EXPIRED";

export interface OrderTicket {
  id: string;
  decisionLogId: string;
  generatedAt: string;
  strategy: string;
  strategyId: StrategyId | null;
  symbol: string;
  side: "short" | "long" | "none";
  instrument: HypotheticalAction;
  entryPrice: number;
  entryOptionMark: number | null;
  strike: number | null;
  stopLoss: number;
  takeProfit: number | null;
  positionSizePct: number;
  maxRiskPct: number;
  invalidation: string;
  forcedExit: string;
  confidence: number;
  confidenceLevel: string;
  topReasons: string[];
}

export interface PreTradeCheckItem {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface PreTradeChecklistResult {
  allPassed: boolean;
  items: PreTradeCheckItem[];
  blockedReason: string | null;
}

export interface TradeControlActionLog {
  action: TradeControlActionType;
  executionMode: ExecutionMode;
  operatorNote: string;
  timestamp: string;
  ticketPatch?: Partial<
    Pick<OrderTicket, "positionSizePct" | "stopLoss" | "maxRiskPct">
  >;
}

export interface TradeControlState {
  status: TradeControlStatus;
  checklist: PreTradeChecklistResult;
  actions: TradeControlActionLog[];
  lastExecutionMode?: ExecutionMode;
  livePlaceholderNote?: string;
}

export interface TradeControlSettings {
  humanApprovalRequired: boolean;
  defaultExecutionMode: ExecutionMode;
  maxPositionSizePct: number;
}

export const TRADE_CONTROL_SETTINGS_KEY =
  "trading-agents-crypto-desk:trade-control-settings";

export const DEFAULT_TRADE_CONTROL_SETTINGS: TradeControlSettings = {
  humanApprovalRequired: true,
  defaultExecutionMode: "PAPER_EXECUTE",
  maxPositionSizePct: 2.5,
};
