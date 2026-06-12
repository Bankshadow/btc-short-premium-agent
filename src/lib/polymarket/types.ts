export type PolymarketAsset = "BTC" | "ETH" | "CRYPTO";
export type PolymarketMarketStatus = "ACTIVE" | "CLOSED" | "RESOLVED" | "PAUSED";
export type PolymarketMarketType = "UP_DOWN" | "ABOVE_BELOW" | "PRICE_TARGET" | "OTHER";

export type SignalSide = "BUY_YES" | "BUY_NO" | "SELL_YES" | "SELL_NO";
export type SignalStatus = "OPEN" | "BLOCKED" | "EXECUTED" | "EXPIRED";
export type PaperTradeStatus = "OPEN" | "CLOSED" | "RESOLVED" | "CANCELLED";
export type FillStatus = "FILLED" | "PARTIAL" | "REJECTED" | "SIMULATED";
export type DataQualityStatus = "FRESH" | "STALE" | "DEGRADED" | "MISSING";
export type RiskSeverity = "INFO" | "WARN" | "BLOCK";

export interface PolymarketMarket {
  marketId: string;
  question: string;
  slug: string;
  asset: PolymarketAsset;
  marketType: PolymarketMarketType;
  outcomes: { yes: string; no: string };
  resolutionTime: string;
  endTime: string;
  yesPrice: number;
  noPrice: number;
  bestBidYes: number;
  bestAskYes: number;
  bestBidNo: number;
  bestAskNo: number;
  liquidity: number;
  volume: number;
  status: PolymarketMarketStatus;
  sourceUrl: string;
  strikePrice?: number;
  referencePrice?: number;
  capturedAt: string;
}

export interface CryptoPriceSnapshot {
  symbol: "BTC" | "ETH";
  price: number;
  timestamp: string;
  quality: DataQualityStatus;
  change5s: number;
  change15s: number;
  change1m: number;
  change5m: number;
  volatility: number;
  momentumScore: number;
}

export interface FairProbabilityResult {
  marketId: string;
  fairProbabilityYes: number;
  fairProbabilityNo: number;
  confidenceScore: number;
  modelReason: string;
  assumptions: string[];
  timestamp: string;
}

export interface MispricingOpportunity {
  marketId: string;
  fairProbabilityYes: number;
  bestBidYes: number;
  bestAskYes: number;
  midPriceYes: number;
  spreadYes: number;
  edgeToBuyYes: number;
  edgeToSellYes: number;
  edgeToBuyNo: number;
  liquidityScore: number;
  executionScore: number;
  latencyRiskScore: number;
  overallOpportunityScore: number;
  timeRemainingSeconds: number;
}

export interface MispricingSignal {
  signalId: string;
  marketId: string;
  side: SignalSide;
  suggestedPrice: number;
  fairPrice: number;
  estimatedEdge: number;
  confidence: number;
  suggestedSizeSimulated: number;
  reason: string;
  riskFlags: string[];
  status: SignalStatus;
  commentary?: string;
  createdAt: string;
}

export interface BlockedSignalRecord {
  signalId: string;
  marketId: string;
  side: SignalSide | null;
  reason: string;
  riskFlags: string[];
  ruleCodes: string[];
  createdAt: string;
}

export interface PaperTradeRecord {
  tradeId: string;
  signalId: string;
  marketId: string;
  side: SignalSide;
  simulatedEntryPrice: number;
  simulatedSize: number;
  estimatedEdgeAtEntry: number;
  confidenceAtEntry: number;
  fillStatus: FillStatus;
  fillReason: string;
  exitPrice: number | null;
  currentPrice: number | null;
  realizedPnl: number;
  unrealizedPnl: number;
  status: PaperTradeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RiskEventRecord {
  eventId: string;
  marketId: string | null;
  ruleCode: string;
  severity: RiskSeverity;
  action: "ALLOW" | "BLOCK" | "KILL_SWITCH";
  reason: string;
  createdAt: string;
}

export interface MarketSnapshotRecord {
  snapshotId: string;
  markets: PolymarketMarket[];
  capturedAt: string;
}

export interface PolymarketHealthReport {
  status: "OK" | "WARNING" | "BLOCKED";
  polymarketDataFresh: boolean;
  cryptoDataFresh: boolean;
  fairPriceEngineOk: boolean;
  paperSimulatorOk: boolean;
  riskManagerOk: boolean;
  killSwitchActive: boolean;
  lastSuccessfulUpdate: string | null;
  errorCount: number;
  messages: string[];
  realTradingEnabled: false;
  paperTradingEnabled: boolean;
}

export interface PolymarketDashboardData {
  markets: PolymarketMarket[];
  fairPrices: FairProbabilityResult[];
  opportunities: MispricingOpportunity[];
  signals: MispricingSignal[];
  blockedSignals: BlockedSignalRecord[];
  paperTrades: PaperTradeRecord[];
  riskEvents: RiskEventRecord[];
  cryptoSnapshots: CryptoPriceSnapshot[];
  health: PolymarketHealthReport;
  commentary: string[];
  orderBooks: import("./sweeper-types").OrderBookSnapshot[];
  sweeperOpportunities: import("./sweeper-types").SweeperOpportunity[];
  blockedSweeperOpportunities: import("./sweeper-types").BlockedSweeperRecord[];
  sweeperPaperTrades: import("./sweeper-types").SweeperPaperTrade[];
}

export interface PolymarketCycleResult {
  ok: boolean;
  runId: string;
  marketsScanned: number;
  signalsCreated: number;
  signalsBlocked: number;
  paperTradesCreated: number;
  health: PolymarketHealthReport;
  commentary: string[];
  sweeper?: import("./sweeper-types").SweeperScanResult;
}
