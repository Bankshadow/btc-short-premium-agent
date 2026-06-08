/** MVP 79 — Prediction Market Arbitrage (paper / simulation only). */
export const PREDICTION_ARB_MVP = 79;

export const PREDICTION_ARB_SAFETY_NOTICE =
  "Paper trading and simulation only. No Polymarket, Kalshi, or live prediction-market orders. " +
  "Opportunities are analytical — fees, liquidity, settlement, and oracle risk may invalidate edges.";

export type MarketType = "BINARY" | "MULTI_OUTCOME";
export type OpportunityType = "BUY_BUNDLE" | "SELL_BUNDLE";
export type CommitteeVerdict = "TRADE" | "WATCH" | "NO_TRADE";
export type OpportunityStatus = CommitteeVerdict;

export interface OrderBookLevel {
  price: number;
  size: number;
}

export interface OutcomeBook {
  outcomeId: string;
  outcomeLabel: string;
  role: "YES" | "NO" | "OUTCOME";
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  bestBid: number | null;
  bestAsk: number | null;
  mid: number | null;
}

export interface NormalizedPredictionMarket {
  id: string;
  eventId: string;
  eventTitle: string;
  marketTitle: string;
  marketType: MarketType;
  outcomes: OutcomeBook[];
  resolutionRules: string;
  resolutionDeadline: string | null;
  mutuallyExclusive: boolean;
  feeRate: number;
  slippageBps: number;
  source: "polymarket" | "mock";
  fetchedAt: string;
}

export interface RawMispricingCandidate {
  market: NormalizedPredictionMarket;
  opportunityType: OpportunityType;
  theoreticalEdgePct: number;
  priceSum: number;
  deviationFromParity: number;
  reasons: string[];
}

export interface DepthAnalysis {
  executableSizeUsd: number;
  vwapBundleCost: number;
  topOfBookOnly: boolean;
  depthRejected: boolean;
  depthRejectReason: string | null;
  perOutcomeFill: { outcomeId: string; vwap: number; filledSize: number }[];
}

export interface ResolutionRiskScore {
  score: number;
  ambiguity: number;
  oracleRisk: number;
  deadlineRisk: number;
  subjectiveWording: number;
  blocked: boolean;
  flags: string[];
  summary: string;
}

export interface ExecutionSimulation {
  expectedProfitUsd: number;
  worstCaseLossUsd: number;
  requiredCapitalUsd: number;
  confidenceScore: number;
  executableEdgePct: number;
  staleBookPenaltyPct: number;
  latencyMs: number;
  partialFillRatio: number;
  capitalLockHours: number;
  notes: string[];
}

export interface AgentVote {
  agentName: string;
  recommendation: CommitteeVerdict;
  confidence: number;
  reasons: string[];
  risks: string[];
}

export interface ArbOpportunity {
  id: string;
  eventTitle: string;
  marketTitle: string;
  marketType: MarketType;
  opportunityType: OpportunityType;
  theoreticalEdgePct: number;
  executableEdgePct: number;
  executableSizeUsd: number;
  requiredCapitalUsd: number;
  resolutionRiskScore: number;
  resolutionBlocked: boolean;
  depthRejected: boolean;
  status: OpportunityStatus;
  noTradeReason: string | null;
  committeeVerdict: CommitteeVerdict;
  committeeSummary: string;
  agentVotes: AgentVote[];
  simulation: ExecutionSimulation;
  depth: DepthAnalysis;
  resolution: ResolutionRiskScore;
  marketId: string;
  source: NormalizedPredictionMarket["source"];
  scannedAt: string;
}

export interface PredictionArbScanResult {
  mvp: typeof PREDICTION_ARB_MVP;
  generatedAt: string;
  marketsScanned: number;
  candidatesFound: number;
  opportunities: ArbOpportunity[];
  tradeCount: number;
  watchCount: number;
  noTradeCount: number;
  dataSource: "live" | "mock" | "mixed";
  scanLogId: string;
  disclaimer: string;
  simulationOnly: true;
  cannotExecuteOrders: true;
}

export interface PredictionArbScanLogEntry {
  id: string;
  generatedAt: string;
  marketsScanned: number;
  opportunities: ArbOpportunity[];
  dataSource: PredictionArbScanResult["dataSource"];
  replayPayload: {
    configSnapshot: Record<string, number>;
    marketIds: string[];
  };
}
