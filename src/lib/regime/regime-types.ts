export type RegimeTag =
  | "TRENDING_UP"
  | "TRENDING_DOWN"
  | "RANGE"
  | "HIGH_VOLATILITY"
  | "LOW_VOLATILITY"
  | "RISK_OFF"
  | "LIQUIDITY_TRAP"
  | "UNKNOWN";

export interface RegimeClassification {
  regime: RegimeTag;
  confidence: number;
  reasons: string[];
  classifiedAt: string;
}

export interface RegimeMemoryEntry {
  tradeId: string;
  regime: RegimeTag;
  result: string;
  netPnl: number;
  lesson: string | null;
  closedAt: string;
}

export interface RegimeMemoryResult {
  currentRegime: RegimeTag;
  similarTrades: RegimeMemoryEntry[];
  lessons: string[];
  retrievedAt: string;
}
