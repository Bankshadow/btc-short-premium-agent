export type TradeResult = "WIN" | "LOSS" | "BREAKEVEN";
export type PnlStatus = "REALIZED" | "PENDING_DATA" | "BLOCKED";
export type PnlEnvironment = "TESTNET" | "PAPER" | "LIVE";
export type PositionSide = "LONG" | "SHORT";

export type PnlPendingDataReason =
  | "MISSING_TRADE_ID"
  | "MISSING_POSITION_ID"
  | "ZERO_QTY"
  | "MISSING_ENTRY_PRICE"
  | "MISSING_EXIT_PRICE"
  | "INVALID_SIDE"
  | "MISSING_CLOSE_EVENT"
  | "MISSING_FILL_DATA"
  | "LIVE_ENV_BLOCKED"
  | "INVALID_TIMestamps";

/** @deprecated Use PnlInput — kept for legacy calculator callers */
export interface PnlCalculationInput {
  tradeId: string;
  symbol: string;
  side: "BUY" | "SELL";
  qty: string;
  entryPrice: number | null;
  exitPrice: number | null;
  feeEstimate?: number;
}

export interface PnlInput {
  tradeId: string;
  positionId: string;
  symbol: string;
  side: PositionSide;
  qty: string;
  entryPrice: number | null;
  exitPrice: number | null;
  entryFee: number;
  exitFee: number;
  openedAt: string | null;
  closedAt: string | null;
  environment: PnlEnvironment;
}

export interface PnlValidationResult {
  valid: boolean;
  reasons: PnlPendingDataReason[];
  warnings: string[];
}

export interface PnlCalculationResult {
  ok: boolean;
  status: "REALIZED" | "PENDING_DATA";
  grossPnl: number | null;
  entryFee: number;
  exitFee: number;
  netPnl: number | null;
  pnlPct: number | null;
  result: TradeResult | null;
  reasons: PnlPendingDataReason[];
  warnings: string[];
  message: string;
}

export interface TradeResultClassification {
  tradeId: string;
  result: TradeResult;
  netPnl: number;
  classifiedAt: string;
}

export interface RealizedPnlRecord {
  tradeId: string;
  positionId: string | null;
  runId: string | null;
  decisionLogId: string | null;
  symbol: string;
  side: PositionSide;
  qty: string;
  entryPrice: number;
  exitPrice: number;
  grossPnl: number;
  entryFee: number;
  exitFee: number;
  feeEstimate: number;
  netPnl: number;
  pnlPct: number;
  result: TradeResult;
  calculatedAt: string;
  status: "REALIZED";
  environment: PnlEnvironment;
}

export interface PendingPnlTrade {
  tradeId: string;
  positionId: string | null;
  symbol: string;
  side: PositionSide | null;
  qty: string | null;
  entryPrice: number | null;
  exitPrice: number | null;
  closedAt: string | null;
  reasons: PnlPendingDataReason[];
  message: string;
  lastPendingAt: string | null;
}

export interface PnlProcessResult {
  ok: boolean;
  status: PnlStatus;
  tradeId: string | null;
  positionId: string | null;
  pnl: RealizedPnlRecord | null;
  reasons: PnlPendingDataReason[];
  warnings: string[];
  message: string;
  eventsWritten: number;
  alreadyRealized?: boolean;
}

/** @deprecated Use PnlProcessResult */
export interface CalculatePnlResult {
  ok: boolean;
  record: RealizedPnlRecord | null;
  status: "REALIZED" | "PNL_PENDING_DATA" | "BLOCKED";
  message: string;
  alreadyRealized?: boolean;
  reasons?: PnlPendingDataReason[];
}
