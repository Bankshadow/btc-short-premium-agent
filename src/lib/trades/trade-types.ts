export type TradeEnvironment = "TESTNET";
export type TradeStatus = "OPEN" | "CLOSED" | "CLOSED_PENDING_PNL";
export type TradeSource = "BINANCE_TESTNET";

export interface OpenTrade {
  tradeId: string;
  previewId: string;
  runId: string;
  decisionLogId: string;
  environment: TradeEnvironment;
  symbol: string;
  side: "BUY" | "SELL";
  qty: string;
  notionalUsd: number;
  orderId: string;
  clientOrderId: string;
  entryPrice: number | null;
  status: "OPEN";
  openedAt: string;
  source: TradeSource;
  strategyVersionId: string | null;
}

export interface ClosedTrade {
  tradeId: string;
  previewId: string | null;
  runId: string | null;
  decisionLogId: string | null;
  environment: TradeEnvironment;
  symbol: string;
  side: "BUY" | "SELL";
  qty: string;
  entryPrice: number | null;
  exitPrice: number | null;
  netPnl: number;
  result: string;
  status: "CLOSED" | "CLOSED_PENDING_PNL";
  closeOrderId: string | null;
  openedAt: string;
  closedAt: string;
  learningId: string | null;
  source: TradeSource;
  strategyVersionId: string | null;
}

export function newTradeId(): string {
  return `trade-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
