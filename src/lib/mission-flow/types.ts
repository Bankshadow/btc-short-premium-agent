import type { AIActivityStatus } from "@/lib/goal-engine/types";

export type BinanceTestnetFlowStatus =
  | "CONNECTED"
  | "DISCONNECTED"
  | "CHECKING"
  | "BLOCKED";

export interface MissionFlowPosition {
  environment: string;
  symbol: string;
  side: string;
  entryPrice: number;
  markPrice: number | null;
  unrealizedPnlUsd: number;
  summary: string;
}

export interface MissionFlowSnapshot {
  startCapital: number;
  targetCapital: number;
  currentEquity: number;
  progressPct: number;
  remainingToTarget: number;
  netPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number | null;
  maxDrawdown: number;
  currentPosition: MissionFlowPosition | null;
  aiStatus: {
    state: AIActivityStatus;
    lastAction: string;
    nextAction: string;
    humanActionRequired: boolean;
  };
  binanceTestnet: {
    status: BinanceTestnetFlowStatus;
    reason: string;
    proxyProvider: string | null;
  };
  lastUpdatedAt: string;
  lastCycleAt: string | null;
  lastVerdict: string | null;
  latestDecisionLogId: string | null;
  lastDeskRunId: string | null;
  risk: {
    liveLocked: boolean;
    testnetStatus: string;
    blocker: string | null;
  };
  trust: {
    completedTrades: number;
    minRequired: number;
    ready: boolean;
  };
  nextRecommendation: string;
  scopeLabel: string;
  enginesNeedingAttention: number;
  learnedTrades: number;
  pendingLearningReview: number;
}

export interface MissionFlowApiResponse {
  ok: boolean;
  snapshot: MissionFlowSnapshot;
  error?: string;
}
