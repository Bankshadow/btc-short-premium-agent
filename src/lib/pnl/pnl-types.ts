export type TradeResult = "WIN" | "LOSS" | "BREAKEVEN";
export type PnlStatus = "REALIZED" | "PNL_PENDING_DATA";

export interface PnlCalculationInput {
  tradeId: string;
  symbol: string;
  side: "BUY" | "SELL";
  qty: string;
  entryPrice: number | null;
  exitPrice: number | null;
  feeEstimate?: number;
}

export interface PnlCalculationResult {
  ok: boolean;
  status: PnlStatus;
  grossPnl: number | null;
  feeEstimate: number;
  netPnl: number | null;
  pnlPct: number | null;
  result: TradeResult | null;
  message: string;
}

export interface RealizedPnlRecord {
  tradeId: string;
  runId: string | null;
  decisionLogId: string | null;
  symbol: string;
  side: "BUY" | "SELL";
  qty: string;
  entryPrice: number;
  exitPrice: number;
  grossPnl: number;
  feeEstimate: number;
  netPnl: number;
  pnlPct: number;
  result: TradeResult;
  calculatedAt: string;
  status: "REALIZED";
}

export interface CalculatePnlResult {
  ok: boolean;
  record: RealizedPnlRecord | null;
  status: PnlStatus;
  message: string;
  alreadyRealized?: boolean;
}
