export interface PolymarketConfig {
  minEdgeThreshold: number;
  minConfidenceScore: number;
  maxSpread: number;
  minLiquidity: number;
  maxExposurePerMarket: number;
  maxExposureTotal: number;
  maxTradesPerHour: number;
  maxDailyLoss: number;
  minTimeRemainingSeconds: number;
  staleDataThresholdSeconds: number;
  paperTradingEnabled: boolean;
  realTradingEnabled: false;
  killSwitchActive: boolean;
  mockMode: boolean;
}
