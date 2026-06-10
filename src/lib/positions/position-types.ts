export type PositionEnvironment = "TESTNET";
export type PositionSide = "LONG" | "SHORT";
export type PositionStatus = "OPEN" | "FLAT" | "UNKNOWN";
export type PositionSource = "BINANCE_TESTNET";
export type ReconciliationStatus = "OK" | "WARNING" | "BLOCKED";

export const POSITION_REFRESH_STALE_MS = 15 * 60 * 1000;

export interface PositionSnapshot {
  positionId: string;
  tradeId: string;
  previewId: string;
  runId: string;
  decisionLogId: string;
  environment: PositionEnvironment;
  symbol: string;
  side: PositionSide;
  qty: string;
  entryPrice: number | null;
  markPrice: number | null;
  notionalUsd: number | null;
  unrealizedPnl: number | null;
  unrealizedPnlPct: number | null;
  leverage: number | null;
  source: PositionSource;
  refreshedAt: string;
  status: PositionStatus;
}

export interface ReconciliationIssue {
  code: string;
  severity: "WARNING" | "BLOCKED";
  message: string;
}

export interface ReconciliationResult {
  status: ReconciliationStatus;
  issues: ReconciliationIssue[];
  openTradeCount: number;
  binancePositionCount: number;
  lastMonitoredAt: string | null;
}

export interface OpenPositionsResponse {
  snapshots: PositionSnapshot[];
  reconciliation: ReconciliationResult;
  message: string;
}

export function tradeSideToPositionSide(side: "BUY" | "SELL"): PositionSide {
  return side === "BUY" ? "LONG" : "SHORT";
}

export function closeSideForPosition(side: PositionSide): "BUY" | "SELL" {
  return side === "LONG" ? "SELL" : "BUY";
}

export function positionSideFromAmt(amt: number): PositionSide | null {
  if (Math.abs(amt) < 1e-8) return null;
  return amt > 0 ? "LONG" : "SHORT";
}
