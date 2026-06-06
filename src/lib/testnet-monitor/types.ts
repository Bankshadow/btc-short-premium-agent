export type TestnetExchange = "BINANCE";
export type TestnetEnvironment = "TESTNET";

export type TestnetOrderSide = "BUY" | "SELL";
export type TestnetPositionSide = "LONG" | "SHORT" | "BOTH";
export type TestnetOrderSource = "AI_SIGNAL" | "MANUAL_TEST" | "AUTOPILOT";
export type TestnetPositionStatus = "OPEN" | "CLOSING" | "CLOSED";
export type TestnetTradeResult = "WIN" | "LOSS" | "BREAKEVEN";
export type TestnetRiskStatus = "SAFE" | "CAUTION" | "BLOCKED";

export type TestnetMonitorEventType =
  | "PREVIEW_CREATED"
  | "ORDER_EXECUTED"
  | "POSITION_OPENED"
  | "CLOSE_REQUESTED"
  | "POSITION_CLOSED"
  | "PNL_REALIZED"
  | "LEARNING_UPDATED"
  | "ERROR";

export interface TestnetOrder {
  id: string;
  exchange: TestnetExchange;
  symbol: string;
  side: TestnetOrderSide;
  positionSide?: TestnetPositionSide;
  orderType: string;
  status: string;
  qty: string;
  avgFillPrice: number | null;
  fee: number | null;
  clientOrderId: string | null;
  exchangeOrderId: string | null;
  previewId: string | null;
  decisionLogId: string | null;
  source: TestnetOrderSource;
  aiVerdict: string | null;
  confidence: number | null;
  strategy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TestnetPosition {
  id: string;
  exchange: TestnetExchange;
  symbol: string;
  side: TestnetPositionSide;
  qty: string;
  entryPrice: number;
  markPrice: number;
  liquidationPrice: number | null;
  leverage: number;
  margin: number | null;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  notionalUsd: number;
  openedAt: string;
  decisionLogId: string | null;
  source: TestnetOrderSource;
  strategy: string | null;
  aiVerdict: string | null;
  confidence: number | null;
  status: TestnetPositionStatus;
  previewId: string | null;
  journalTradeId: string | null;
}

export interface TestnetClosedTrade {
  id: string;
  exchange: TestnetExchange;
  symbol: string;
  side: TestnetPositionSide;
  entryPrice: number;
  exitPrice: number;
  qty: string;
  grossPnl: number;
  fee: number;
  netPnl: number;
  rMultiple: number | null;
  result: TestnetTradeResult;
  durationMs: number;
  decisionLogId: string | null;
  strategy: string | null;
  aiVerdict: string | null;
  confidence: number | null;
  openedAt: string;
  closedAt: string;
  notes: string | null;
  learned: boolean;
  previewId: string | null;
}

export interface TestnetMonitorSummary {
  openPositionCount: number;
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  netPnl: number;
  dailyPnl: number;
  winRate: number;
  tradeCount: number;
  winningTrades: number;
  losingTrades: number;
  totalFees: number;
  maxDrawdown: number;
  riskStatus: TestnetRiskStatus;
  environment: TestnetEnvironment;
  exchange: TestnetExchange;
  liveTradingDisabled: true;
}

export interface TestnetDailyPnlPoint {
  date: string;
  netPnl: number;
  tradeCount: number;
}

export interface TestnetPnlByGroup {
  label: string;
  netPnl: number;
  tradeCount: number;
  winRate: number;
}

export interface TestnetMonitorSnapshot {
  openPositions: TestnetPosition[];
  openOrders: TestnetOrder[];
  closedTrades: TestnetClosedTrade[];
  summary: TestnetMonitorSummary;
  dailyPnlSeries: TestnetDailyPnlPoint[];
  pnlBySymbol: TestnetPnlByGroup[];
  pnlByStrategy: TestnetPnlByGroup[];
  equitySeries: Array<{ timestamp: string; equity: number }>;
  learningRecords: TestnetLearningRecord[];
  learningQueue: TestnetLearningQueueItem[];
  agentScoreboardSegment: TestnetAgentScoreboardSegment;
  strategyPerformanceSegment: TestnetStrategyPerformanceSegment;
  validationMetricsSegment: TestnetValidationMetricsSegment;
  executionQuality: import("@/lib/execution-quality/types").ExecutionQualitySummary;
  lastUpdatedAt: string;
  connected: boolean;
  mismatches: string[];
}

export interface TestnetMonitorJournalEvent {
  journalId: string;
  exchange: TestnetExchange;
  environment: TestnetEnvironment;
  eventType: TestnetMonitorEventType;
  symbol: string | null;
  payload: Record<string, unknown>;
  decisionLogId: string | null;
  orderId: string | null;
  positionId: string | null;
  timestamp: string;
}

export interface TestnetLearningQueueItem {
  learningRecordId?: string;
  closedTradeId: string;
  symbol: string;
  decisionLogId: string | null;
  netPnl: number;
  result: TestnetTradeResult;
  closedAt: string;
  status: "PENDING_REVIEW" | "LEARNED" | "REFLECTION_READY" | "EXCLUDED";
  reflectionNotes: string | null;
}

export interface TestnetDecisionLinkage {
  decisionLogId: string | null;
  finalVerdict: string | null;
  committeeVerdict: string | null;
  confidence: number | null;
  topReasons: string[];
  riskVeto: boolean;
  linked: boolean;
  message: string | null;
}

export interface TestnetLearningRecord {
  learningRecordId: string;
  environment: "TESTNET";
  symbol: string;
  decisionLogId: string | null;
  previewId: string | null;
  orderId: string | null;
  positionId: string | null;
  closedTradeId: string;
  strategy: string | null;
  sourceAgent: string | null;
  finalVerdict: string | null;
  confidence: number | null;
  grossPnl: number;
  netPnl: number;
  fee: number;
  rMultiple: number;
  maxFavorableExcursion: number;
  maxAdverseExcursion: number;
  durationMs: number;
  result: TestnetTradeResult;
  includeInLearning: boolean;
  status: "PENDING_REVIEW" | "REFLECTION_READY" | "LEARNED" | "EXCLUDED";
  reflectionNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TestnetAgentScoreRow {
  sourceAgent: string;
  totalLearned: number;
  winningTrades: number;
  winRate: number;
  netPnl: number;
}

export interface TestnetAgentScoreboardSegment {
  environment: "TESTNET";
  totalLearned: number;
  rows: TestnetAgentScoreRow[];
  updatedAt: string;
}

export interface TestnetStrategyPerformanceRow {
  strategy: string;
  totalLearned: number;
  winRate: number;
  netPnl: number;
  averageR: number;
}

export interface TestnetStrategyPerformanceSegment {
  environment: "TESTNET";
  totalLearned: number;
  rows: TestnetStrategyPerformanceRow[];
  updatedAt: string;
}

export interface TestnetValidationMetricsSegment {
  environment: "TESTNET";
  totalClosedTrades: number;
  includedInLearning: number;
  excludedFromLearning: number;
  learnedCount: number;
  winRate: number;
  netPnl: number;
  averageR: number;
  updatedAt: string;
}
