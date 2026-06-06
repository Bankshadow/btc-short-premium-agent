export const QUANT_BACKTEST_SAFETY_NOTICE =
  "Quant backtests are simulation-only. They cannot create orders, change live settings, or promote to testnet without explicit human approval.";

export type QuantBacktestSymbol = "BTCUSDT" | "SOLUSDT";
export type QuantBacktestTimeframe = "1h" | "4h" | "1d";

export type QuantSignalDirection = "LONG" | "SHORT" | "FLAT";

export type AiPaperRecommendation =
  | "PAPER_WORTHY"
  | "BACKTEST_MORE"
  | "REJECT"
  | "INSUFFICIENT_DATA";

export interface QuantFrictionAssumptions {
  /** Per-side fee in basis points (default 4 = 0.04%). */
  feeBps: number;
  /** Per-side slippage in basis points. */
  slippageBps: number;
  /** Half-spread cost applied on entry in basis points. */
  spreadBps: number;
}

export interface QuantStrategyParameters {
  rsiPeriod?: number;
  rsiOversold?: number;
  rsiOverbought?: number;
  bbPeriod?: number;
  bbStdDev?: number;
  dualThrustLookback?: number;
  dualThrustK?: number;
  macdFast?: number;
  macdSlow?: number;
  stopLossAtrMult?: number;
}

export interface QuantBacktestInput {
  sourceId: string;
  symbol: QuantBacktestSymbol;
  timeframe: QuantBacktestTimeframe;
  startDate: string;
  endDate: string;
  friction: QuantFrictionAssumptions;
  parameters?: QuantStrategyParameters;
}

export interface QuantBacktestTrade {
  id: string;
  direction: Exclude<QuantSignalDirection, "FLAT">;
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  grossPnlPct: number;
  netPnlPct: number;
  frictionCostPct: number;
  regime: "bullish" | "bearish" | "neutral";
  barsHeld: number;
}

export interface QuantEquityPoint {
  timestamp: string;
  equityPct: number;
  drawdownPct: number;
}

export interface QuantRegimeBreakdown {
  regime: "bullish" | "bearish" | "neutral";
  tradeCount: number;
  winRate: number;
  netReturnPct: number;
}

export interface QuantBacktestMetrics {
  totalReturnPct: number;
  winRate: number;
  maxDrawdownPct: number;
  profitFactor: number;
  averageWinPct: number;
  averageLossPct: number;
  tradeCount: number;
  expectancyPct: number;
}

export interface QuantLiquidityWarning {
  level: "OK" | "LOW" | "VERY_LOW";
  message: string;
  avgBarVolume: number;
}

export interface QuantAiRecommendation {
  verdict: AiPaperRecommendation;
  summary: string;
  reasons: string[];
  paperTestnetAllowed: false;
  humanApprovalRequired: true;
}

export interface QuantBacktestResult {
  runId: string;
  sourceId: string;
  strategyName: string;
  symbol: QuantBacktestSymbol;
  timeframe: QuantBacktestTimeframe;
  startDate: string;
  endDate: string;
  barsLoaded: number;
  friction: QuantFrictionAssumptions;
  frictionTotalPct: number;
  liquidityWarning: QuantLiquidityWarning;
  metrics: QuantBacktestMetrics;
  trades: QuantBacktestTrade[];
  equityCurve: QuantEquityPoint[];
  regimeBreakdown: QuantRegimeBreakdown[];
  aiRecommendation: QuantAiRecommendation;
  simulationOnly: true;
  cannotCreateOrders: true;
  cannotPromoteTestnetWithoutApproval: true;
  completedAt: string;
}
