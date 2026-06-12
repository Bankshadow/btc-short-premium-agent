import type { RiskSeverity, SignalSide } from "./types";

export type SweeperStrategy =
  | "BINARY_UNDER_ONE_ARB"
  | "DUMP_AND_HEDGE"
  | "WIDE_SPREAD_CAPTURE"
  | "CRYPTO_MARKET_LAG"
  | "NEAR_EXPIRY_LIQUIDITY_GAP";

export type SweeperLegSide = SignalSide | "BUNDLE_YES_NO";

export interface OrderBookLevel {
  price: number;
  size: number;
  side: "BID" | "ASK";
  outcome: "YES" | "NO";
}

export interface OrderBookSnapshot {
  marketId: string;
  levels: OrderBookLevel[];
  capturedAt: string;
}

export interface SweeperOpportunity {
  opportunityId: string;
  marketId: string;
  strategy: SweeperStrategy;
  side: SweeperLegSide;
  suggestedPrice: number;
  secondaryPrice?: number;
  estimatedEdge: number;
  confidence: number;
  suggestedSizeSimulated: number;
  sweepScore: number;
  reason: string;
  riskFlags: string[];
  orderBookDepth: number;
  timeRemainingSeconds: number;
  status: "OPEN" | "BLOCKED" | "EXECUTED";
  createdAt: string;
}

export interface BlockedSweeperRecord {
  recordId: string;
  opportunityId: string;
  marketId: string;
  strategy: SweeperStrategy;
  side: SweeperLegSide | null;
  reason: string;
  riskFlags: string[];
  ruleCodes: string[];
  estimatedEdge: number;
  createdAt: string;
}

export interface SweeperPaperTrade {
  tradeId: string;
  opportunityId: string;
  marketId: string;
  strategy: SweeperStrategy;
  side: SweeperLegSide;
  simulatedEntryPrice: number;
  simulatedSecondaryPrice?: number;
  simulatedSize: number;
  estimatedEdgeAtEntry: number;
  confidenceAtEntry: number;
  fillStatus: "SIMULATED" | "PARTIAL" | "REJECTED";
  fillReason: string;
  unrealizedPnl: number;
  realizedPnl: number;
  status: "OPEN" | "CLOSED" | "CANCELLED";
  createdAt: string;
  updatedAt: string;
}

export interface SweeperScanResult {
  ok: boolean;
  runId: string;
  booksScanned: number;
  opportunitiesDetected: number;
  opportunitiesBlocked: number;
  paperTradesCreated: number;
  byStrategy: Record<SweeperStrategy, number>;
}

export interface SweeperRiskCheck {
  allowed: boolean;
  ruleCodes: string[];
  riskFlags: string[];
  reason: string;
  severity: RiskSeverity;
}
