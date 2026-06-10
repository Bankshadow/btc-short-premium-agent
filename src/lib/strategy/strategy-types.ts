export type StrategySetupTag = "SHORT_PREMIUM" | "MEAN_REVERT" | "UNKNOWN";
export type StrategyRegimeTag = "TREND" | "RANGE" | "UNKNOWN";

export interface StrategyTradeTag {
  tradeId: string;
  setup: StrategySetupTag;
  regime: StrategyRegimeTag;
  entryReason: string;
}

export interface StrategyHealthReport {
  generatedAt: string;
  totalClosedTrades: number;
  evidenceTrades: number;
  winRate: number;
  averagePnl: number;
  averageHoldMinutes: number | null;
  maxLoss: number;
  bestSetup: string | null;
  worstSetup: string | null;
  invalidSetupCount: number;
  advisoryOnly: true;
  liveLocked: true;
  message: string;
}
