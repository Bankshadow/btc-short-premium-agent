import type { AIActivityStatus } from "@/lib/goal-engine/types";

import type { EvidenceProgressSnapshot } from "@/lib/evidence-progress/types";
import type { IntegratedStrategyHealthSnapshot } from "@/lib/integrated-strategy-health/types";
import type { MicroLiveReadinessSnapshot } from "@/lib/micro-live-readiness/types";
import type { LearningProgressSnapshot } from "@/lib/learning-queue/types";
import type { MonitorReliabilitySnapshot } from "@/lib/monitor-reliability/types";
import type { IntegratedTradeQualitySnapshot } from "@/lib/trade-quality-score/types";
import type { IntegratedConfidenceCalibrationSnapshot } from "@/lib/integrated-confidence-calibration/types";
import type { IntegratedRiskBudgetSnapshot } from "@/lib/integrated-risk-budget/types";
import type { IntegratedDailySelfReviewSnapshot } from "@/lib/integrated-daily-self-review/types";
import type { EvidenceQualitySnapshot } from "@/lib/evidence-quality/types";
import type { IntegratedQualityCalibrationSnapshot } from "@/lib/integrated-quality-calibration/types";
import type { IntegratedStrategyAgentHealthSnapshot } from "@/lib/integrated-strategy-agent-health/types";
import type { MissionControllerRiskBudgetSnapshot } from "@/lib/mission-controller-risk-budget/types";
import type { AlwaysOnOperatorLayerSnapshot } from "@/lib/always-on-operator-layer/types";
import type { MicroLiveReadinessReviewSnapshot } from "@/lib/micro-live-readiness-review/types";

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
  canCloseOnTestnet: boolean;
}

export interface MissionFlowPendingPreview {
  previewId: string;
  symbol: string;
  side: string;
  notionalUsd: number;
  estimatedQty: string;
  markPrice: number | null;
  expiresAt: string;
  blocked: boolean;
  blockReasons: string[];
  reason: string;
  decisionLogId: string | null;
}

export interface MissionFlowAutomation {
  enabled: boolean;
  paused: boolean;
  intervalMinutes: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastRunStatus: string | null;
  lastTrigger: string | null;
  /** Server env BINANCE_TESTNET_AUTOEXECUTE_ENABLED — trades without UI confirm. */
  autoExecuteEnabled: boolean;
  /** Closed trades auto-marked learned during automation cycles. */
  autoLearnEnabled: boolean;
}

export interface MissionFlowNotifications {
  telegramConfigured: boolean;
  notifyOnTrade: boolean;
  notifyOnBlocker: boolean;
  lastAlertAt: string | null;
}

export interface MissionFlowLearningItem {
  learningRecordId: string;
  symbol: string;
  netPnl: number;
  result: string;
  updatedAt: string;
}

export interface MissionFlowActivityItem {
  id: string;
  at: string;
  trigger: string;
  status: string;
  summary: string;
  verdict: string | null;
  jobCount: number;
}

export interface MissionFlowLearningInsights {
  learnedCount: number;
  winCount: number;
  lossCount: number;
  avgR: number | null;
  recent: {
    symbol: string;
    result: string;
    netPnl: number;
    rMultiple: number;
    updatedAt: string;
  }[];
}

export interface MissionFlowSelfLearning {
  serverEvaluated: number;
  lastTopAgent: string | null;
  lastEvaluatedAt: string | null;
}

export interface MissionFlowStrategyHealth {
  strategyId: string;
  label: string;
  status: string;
  recommendation: string;
  winRate: number;
  sampleSize: number;
  healthScorePct: number | null;
  tradeAllowed: boolean;
  blockReason: string | null;
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
  pendingTestnetPreview: MissionFlowPendingPreview | null;
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
  learningPending: MissionFlowLearningItem[];
  automation: MissionFlowAutomation;
  notifications: MissionFlowNotifications;
  recentActivity: MissionFlowActivityItem[];
  learningInsights: MissionFlowLearningInsights;
  strategyHealth: MissionFlowStrategyHealth | null;
  trustNotionalUsd: number;
  evidenceProgress: EvidenceProgressSnapshot;
  monitorReliability: MonitorReliabilitySnapshot;
  learningProgress: LearningProgressSnapshot;
  integratedStrategyHealth: IntegratedStrategyHealthSnapshot;
  microLiveReadiness: MicroLiveReadinessSnapshot;
  integratedTradeQuality: IntegratedTradeQualitySnapshot;
  integratedConfidenceCalibration: IntegratedConfidenceCalibrationSnapshot;
  integratedRiskBudget: IntegratedRiskBudgetSnapshot;
  integratedDailySelfReview: IntegratedDailySelfReviewSnapshot;
  evidenceQuality: EvidenceQualitySnapshot;
  integratedQualityCalibration: IntegratedQualityCalibrationSnapshot;
  integratedStrategyAgentHealth: IntegratedStrategyAgentHealthSnapshot;
  missionControllerRiskBudget: MissionControllerRiskBudgetSnapshot;
  alwaysOnOperatorLayer: AlwaysOnOperatorLayerSnapshot;
  microLiveReadinessReview: MicroLiveReadinessReviewSnapshot;
  selfLearning: MissionFlowSelfLearning;
}

export interface MissionFlowBuildResult {
  snapshot: MissionFlowSnapshot;
  degraded: boolean;
  warnings: string[];
  cached: boolean;
}

export interface MissionFlowApiResponse {
  ok: boolean;
  snapshot: MissionFlowSnapshot;
  degraded?: boolean;
  warnings?: string[];
  cached?: boolean;
  error?: string;
}
