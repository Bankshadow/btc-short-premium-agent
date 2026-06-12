export interface TerminalBundle {
  meta: TerminalMeta;
  commandCenter: TerminalCommandCenter;
  marketData: TerminalMarketData;
  polymarketMispricing: TerminalMispricingRow[];
  sweeperScanner: TerminalSweeperRow[];
  agentDebate: TerminalAgentDebate;
  riskGuard: TerminalRiskGuardRow[];
  paperBlotter: TerminalPaperTradeRow[];
  decisionJournal: TerminalDecisionRow[];
  systemHealth: TerminalSystemHealth;
  configPanel: TerminalConfigPanel;
}

export interface TerminalMeta {
  builtAt: string;
  source: "LIVE_AGGREGATION" | "PARTIAL_FALLBACK";
  warnings: string[];
  paperOnly: true;
  realTradingEnabled: false;
  liveLocked: true;
}

export interface TerminalCommandCenter {
  btcRegime: string;
  ethRegime: string;
  activeThesis: string | null;
  thesisConfidence: number | null;
  riskMode: "CONSERVATIVE" | "NORMAL" | "AGGRESSIVE";
  systemHealthStatus: "OK" | "WARNING" | "BLOCKED";
  paperTradingStatus: "ENABLED" | "DISABLED";
  killSwitchActive: boolean;
  killSwitchReason: string | null;
  engineState: "RUNNING" | "PAUSED";
}

export interface TerminalMarketData {
  btc: TerminalAssetTick;
  eth: TerminalAssetTick;
}

export interface TerminalAssetTick {
  price: number;
  fundingRate: number | null;
  fundingSimulated: boolean;
  volatility: number;
  trend: string;
  momentum: number;
  dataFreshnessSec: number;
  quality: "FRESH" | "STALE" | "UNKNOWN";
}

export interface TerminalMispricingRow {
  marketId: string;
  marketLabel: string;
  fairProbability: number;
  polymarketPrice: number;
  edge: number;
  confidence: number;
  liquidity: number;
  spread: number;
  status: string;
}

export interface TerminalSweeperRow {
  opportunityId: string;
  marketId: string;
  opportunityType: string;
  yesAsk: number | null;
  noAsk: number | null;
  totalCost: number | null;
  grossEdge: number;
  netEdge: number | null;
  riskFlags: string[];
  signalStatus: "OPEN" | "BLOCKED";
  paperTradeStatus: "NONE" | "OPEN" | "CLOSED" | "CANCELLED" | "PARTIAL";
  createdAt: string;
}

export interface TerminalAgentDebate {
  bullThesis: string | null;
  bearThesis: string | null;
  quantView: string | null;
  riskManagerView: string | null;
  committeeView: string | null;
  finalRecommendation: "TRADE" | "WAIT" | "BLOCKED" | null;
  unresolvedDisagreements: string[];
  advisoryOnly: true;
}

export interface TerminalRiskGuardRow {
  id: string;
  source: "POLYMARKET" | "BINANCE" | "PORTFOLIO" | "OPERATOR" | "RULES" | "SWEEPER";
  blockedSignal: string;
  triggeredRules: string[];
  severity: "INFO" | "WARN" | "BLOCK";
  reason: string;
  recommendedAction: string;
  createdAt: string;
}

export interface TerminalPaperTradeRow {
  tradeId: string;
  source: "TESTNET" | "POLYMARKET" | "SWEEPER";
  symbolOrMarket: string;
  side: string;
  entryPrice: number;
  currentPrice: number | null;
  size: number;
  unrealizedPnl: number;
  realizedPnl: number;
  status: string;
  createdAt: string;
}

export interface TerminalDecisionRow {
  decisionId: string;
  signalSource: string;
  thesis: string;
  riskNotes: string;
  outcome: string | null;
  reflection: string | null;
  timestamp: string;
}

export interface TerminalSystemHealth {
  marketDataFresh: boolean;
  polymarketDataFresh: boolean;
  fairPriceEngineOk: boolean;
  riskEngineOk: boolean;
  paperSimulatorOk: boolean;
  errorCount: number;
  messages: string[];
}

export interface TerminalConfigPanel {
  minEdge: number;
  minConfidence: number;
  maxSpread: number;
  minLiquidity: number;
  maxExposurePerMarket: number;
  maxExposureTotal: number;
  paperTradingEnabled: boolean;
  realTradingEnabled: false;
  killSwitchEnabled: boolean;
}
