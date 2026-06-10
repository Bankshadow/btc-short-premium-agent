export type BinanceTestnetStatusCode =
  | "CONNECTED"
  | "MISSING_ENV"
  | "PROXY_UNHEALTHY"
  | "BLOCKED_BY_REGION"
  | "AUTH_ERROR"
  | "API_ERROR"
  | "CLOCK_SKEW"
  | "DISCONNECTED";

export interface BinanceTestnetStatus {
  status: BinanceTestnetStatusCode;
  testnetEnabled: boolean;
  liveEnabled: boolean;
  apiKeyPresent: boolean;
  apiSecretPresent: boolean;
  proxyEnabled: boolean;
  proxyUrlConfigured: boolean;
  baseUrl: string;
  serverTimeOk: boolean;
  lastCheckedAt: string;
  reason: string;
  recommendation: string;
}

export interface BinanceServerTime {
  serverTime: number;
}

export interface BinanceAccountSummary {
  totalWalletBalance: string;
  availableBalance: string;
}

export interface BinancePosition {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  unrealizedProfit: string;
  markPrice?: string;
  leverage?: string;
}

export interface BinanceOrderResult {
  orderId: string;
  clientOrderId: string;
  symbol: string;
  side: "BUY" | "SELL";
  type: string;
  status: string;
  origQty: string;
  executedQty: string;
  avgPrice: string | null;
  updateTime: number;
}

export interface BinanceExchangeSymbol {
  symbol: string;
  status: string;
  contractType: string;
}

export type BinanceMarketSide = "BUY" | "SELL";

export interface CreateMarketOrderInput {
  symbol: string;
  side: BinanceMarketSide;
  quantity: string;
  clientOrderId?: string;
  reduceOnly?: boolean;
}

export interface BinanceClientConfig {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  proxyEnabled: boolean;
  proxyUrl: string | null;
  proxySecret: string | null;
}
