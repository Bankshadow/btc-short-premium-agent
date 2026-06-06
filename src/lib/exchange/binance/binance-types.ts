export type BinanceOrderSide = "BUY" | "SELL";
export type BinanceOrderType = "MARKET" | "LIMIT";
export type BinancePreviewSource = "ai_signal" | "manual_test";

export interface BinanceCredentials {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
}

export interface BinanceConfig {
  testnetEnabled: boolean;
  liveEnabled: boolean;
  /** Effective API base — proxy URL when set, otherwise upstream testnet URL. */
  baseUrl: string;
  /** Logical Binance testnet host used for safety validation. */
  upstreamBaseUrl: string;
  proxyEnabled: boolean;
  allowedSymbols: string[];
  maxNotionalUsd: number;
  maxTradesPerDay: number;
  maxOpenPositions: number;
  requireDoubleConfirm: boolean;
  leverage: number;
}

export interface BinanceRiskCheck {
  id: string;
  label: string;
  status: "PASS" | "WARNING" | "FAIL";
  message: string;
  blocking: boolean;
}

export interface BinanceOrderPreviewInput {
  source: BinancePreviewSource;
  symbol: string;
  side: BinanceOrderSide;
  notionalUsd: number;
  reason: string;
  decisionLogId?: string | null;
}

export interface BinanceOrderPreview {
  previewId: string;
  symbol: string;
  side: BinanceOrderSide;
  estimatedQty: string;
  notionalUsd: number;
  markPrice: number | null;
  riskChecks: BinanceRiskCheck[];
  blocked: boolean;
  blockReasons: string[];
  requiresDoubleConfirm: boolean;
  expiresAt: string;
  source: BinancePreviewSource;
  reason: string;
  decisionLogId: string | null;
  generatedAt: string;
}

export interface BinanceExchangeInfoSymbol {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  pricePrecision: number;
  quantityPrecision: number;
  filters: Array<Record<string, string>>;
}

export interface BinanceBalance {
  asset: string;
  balance: string;
  crossWalletBalance: string;
  availableBalance: string;
}

export interface BinancePosition {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  leverage: string;
  positionSide: string;
  notional: string;
}

export interface BinanceOpenOrder {
  orderId: number;
  symbol: string;
  side: BinanceOrderSide;
  type: string;
  origQty: string;
  executedQty: string;
  status: string;
  reduceOnly: boolean;
  time: number;
}

export interface BinanceAccountSnapshot {
  totalWalletBalance: string;
  availableBalance: string;
  totalUnrealizedProfit: string;
  canTrade: boolean;
}

export type BinanceBlockerCategory =
  | "MISSING_KEY"
  | "MISSING_SECRET"
  | "TESTNET_DISABLED"
  | "LIVE_ENABLED"
  | "WRONG_BASE_URL"
  | "API_ERROR"
  | "CLOCK_SKEW"
  | "PERMISSION";

export interface BinanceConnectionBlocker {
  category: BinanceBlockerCategory;
  detail: string;
}

export interface BinanceEnvCheckItem {
  key: string;
  label: string;
  /** Display value — secrets are masked to "set"/"missing". */
  value: string;
  ok: boolean;
  secret: boolean;
}

export interface BinanceStatusResult {
  configured: boolean;
  testnetEnabled: boolean;
  liveEnabled: boolean;
  liveBlocked: boolean;
  baseUrl: string;
  upstreamBaseUrl: string;
  proxyEnabled: boolean;
  autoExecuteEnabled: boolean;
  allowedSymbols: string[];
  connected: boolean;
  serverTimeMs: number | null;
  clockSkewMs: number | null;
  safetyNotice: string;
  error: string | null;
  envChecklist: BinanceEnvCheckItem[];
  blockers: BinanceConnectionBlocker[];
}

export type BinanceJournalStatus =
  | "PREVIEWED"
  | "SUBMITTED"
  | "FILLED"
  | "CLOSING"
  | "CLOSED"
  | "BLOCKED"
  | "FAILED";

export interface BinanceTestnetJournalEntry {
  binanceTestnetTradeId: string;
  previewId: string;
  symbol: string;
  side: BinanceOrderSide;
  notionalUsd: number;
  quantity: string;
  status: BinanceJournalStatus;
  source: BinancePreviewSource;
  reason: string;
  decisionLogId: string | null;
  exchangeOrderId: string | null;
  clientOrderId: string | null;
  operatorNote: string | null;
  blockReasons: string[];
  createdAt: string;
  executedAt: string | null;
  closedAt: string | null;
  realizedPnl: number | null;
  fees: number | null;
  previewPrice?: number | null;
  markPriceAtSubmit?: number | null;
  fillPrice?: number | null;
  slippage?: number | null;
  slippageBps?: number | null;
  latencyMs?: number | null;
  partialFill?: boolean;
  duplicateSubmission?: boolean;
  retryCount?: number;
  closeAttempt?: boolean;
  closeFailed?: boolean;
}

export interface BinanceExecuteInput {
  previewId: string;
  doubleConfirm: boolean;
  operatorNote?: string;
  /** Loop guard blocks blind retries without operator review. */
  blindRetry?: boolean;
}

export interface BinanceExecuteResult {
  ok: boolean;
  blocked: boolean;
  exchangeOrderId: string | null;
  journalEntry: BinanceTestnetJournalEntry;
  error: string | null;
}

export interface BinanceCloseInput {
  symbol: string;
  operatorNote?: string;
  doubleConfirm: boolean;
}

export interface BinanceCloseResult {
  ok: boolean;
  blocked: boolean;
  exchangeOrderId: string | null;
  journalEntry: BinanceTestnetJournalEntry | null;
  error: string | null;
}

export const BINANCE_TESTNET_SAFETY_NOTICE =
  "Binance USD-M Futures Testnet only — production Binance live trading is disabled.";

export const BINANCE_PRODUCTION_HARD_BLOCK =
  "Binance production live trading is disabled. Testnet endpoints only.";
