export type ExchangeNetwork = "testnet" | "mainnet";

export interface ExchangeConfigPublic {
  configured: boolean;
  network: ExchangeNetwork | null;
  baseUrl: string | null;
  readOnly: true;
}

export interface ExchangeCoinBalance {
  coin: string;
  walletBalance: number;
  availableBalance: number;
  equityUsd: number;
}

export interface ExchangeWalletSnapshot {
  accountType: string;
  totalEquityUsd: number;
  totalWalletBalanceUsd: number;
  coins: ExchangeCoinBalance[];
}

export interface ExchangePositionSnapshot {
  category: "linear" | "option";
  symbol: string;
  side: "Buy" | "Sell" | "None";
  size: number;
  avgPrice: number;
  markPrice: number;
  unrealisedPnl: number;
  leverage: number;
  positionValueUsd: number;
  liqPrice: number | null;
}

export interface ExchangeOpenOrderSnapshot {
  category: "linear" | "option";
  orderId: string;
  symbol: string;
  side: "Buy" | "Sell";
  orderType: string;
  price: number;
  qty: number;
  cumExecQty: number;
  orderStatus: string;
  createdTime: string;
}

export type OrderPreviewSource = "perp_signal" | "order_ticket";

export interface OrderPreviewResult {
  valid: boolean;
  source: OrderPreviewSource;
  category: "linear" | "option";
  symbol: string;
  side: string;
  rejectReasons: string[];
  warnings: string[];
  estNotionalUsd: number;
  estQty: number;
  estFeeUsd: number;
  availableBalanceUsd: number | null;
  marginSufficient: boolean | null;
  bybitPayload: Record<string, unknown>;
  slTpPlan: { stopLoss: number | null; takeProfit: number | null };
  configured: boolean;
  network: ExchangeNetwork | null;
  executeConfirmToken: string | null;
  executeConfirmExpiresAt: string | null;
  disclaimer: string;
}

export interface LiveExecuteResult {
  ok: boolean;
  orderId: string | null;
  symbol: string;
  side: string;
  qty: number;
  network: ExchangeNetwork | null;
  testnet: boolean;
  timestamp: string;
  operatorNote: string;
  auditId: string;
  error?: string;
  retCode?: number;
}

export interface ExchangeStatusResult {
  configured: boolean;
  connected: boolean;
  network: ExchangeNetwork | null;
  timestamp: string;
  serverTimeMs: number | null;
  clockSkewMs: number | null;
  wallet: ExchangeWalletSnapshot | null;
  linearPositions: ExchangePositionSnapshot[];
  optionPositions: ExchangePositionSnapshot[];
  openLinearOrders: ExchangeOpenOrderSnapshot[];
  openOptionOrders: ExchangeOpenOrderSnapshot[];
  trackedSymbols: string[];
  error?: string;
  errorCode?: number;
  disclaimer: string;
  envHint?: string;
}
