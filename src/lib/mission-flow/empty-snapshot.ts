import { emptyEvidenceProgress } from "@/lib/evidence-progress";
import { emptyLearningProgress } from "@/lib/learning-queue/empty-snapshot";
import { emptyIntegratedStrategyHealth } from "@/lib/integrated-strategy-health/empty-snapshot";
import { emptyMicroLiveReadiness } from "@/lib/micro-live-readiness/empty-snapshot";
import { emptyIntegratedTradeQuality } from "@/lib/trade-quality-score/empty-snapshot";
import { emptyIntegratedConfidenceCalibration } from "@/lib/integrated-confidence-calibration/empty-snapshot";
import { emptyIntegratedRiskBudget } from "@/lib/integrated-risk-budget/empty-snapshot";
import { emptyIntegratedDailySelfReview } from "@/lib/integrated-daily-self-review/empty-snapshot";
import { emptyEvidenceQualitySnapshot } from "@/lib/evidence-quality/build-evidence-quality";
import { emptyIntegratedQualityCalibration } from "@/lib/integrated-quality-calibration/build-integrated-quality-calibration";
import { emptyIntegratedStrategyAgentHealth } from "@/lib/integrated-strategy-agent-health/build-integrated-strategy-agent-health";
import { emptyMissionControllerRiskBudget } from "@/lib/mission-controller-risk-budget/empty-snapshot";
import { emptyEngineConsistencySnapshot } from "@/lib/engine-consistency/empty-engine-consistency";
import { emptyAlwaysOnOperatorLayer } from "@/lib/always-on-operator-layer/empty-snapshot";
import { emptyMicroLiveReadinessReview } from "@/lib/micro-live-readiness-review/empty-snapshot";
import { emptyMonitorReliabilitySnapshot } from "@/lib/monitor-reliability/empty-snapshot";
import {
  GOAL_MIN_TRADES_FOR_TRUST,
  GOAL_START_CAPITAL,
  GOAL_TARGET_CAPITAL,
} from "@/lib/goal-engine/types";
import type { MissionFlowSnapshot } from "./types";

/** Client + server zero-state — never leaves UI in permanent Loading. */
export function emptyMissionFlowSnapshot(): MissionFlowSnapshot {
  return {
    startCapital: GOAL_START_CAPITAL,
    targetCapital: GOAL_TARGET_CAPITAL,
    currentEquity: GOAL_START_CAPITAL,
    progressPct: 0,
    remainingToTarget: GOAL_TARGET_CAPITAL - GOAL_START_CAPITAL,
    netPnl: 0,
    realizedPnl: 0,
    unrealizedPnl: 0,
    totalTrades: 0,
    openTrades: 0,
    closedTrades: 0,
    wins: 0,
    losses: 0,
    breakeven: 0,
    winRate: null,
    maxDrawdown: 0,
    currentPosition: null,
    pendingTestnetPreview: null,
    aiStatus: {
      state: "IDLE",
      lastAction: "No AI cycle has run yet.",
      nextAction: "Autopilot starts when testnet connects — no manual Start AI required.",
      humanActionRequired: false,
    },
    binanceTestnet: {
      status: "MISSING_ENV",
      reason: "BINANCE_API_KEY / BINANCE_API_SECRET not configured.",
      recommendation: "Set BINANCE_API_KEY, BINANCE_API_SECRET, and BINANCE_TESTNET_ENABLED=true in server env.",
      lastCheckedAt: new Date().toISOString(),
      connected: false,
      testnetEnabled: false,
      liveEnabled: false,
      proxyEnabled: false,
      proxyProvider: null,
      proxyUrlConfigured: false,
      apiKeyPresent: false,
      apiSecretPresent: false,
      baseUrl: "",
    },
    lastUpdatedAt: new Date().toISOString(),
    lastCycleAt: null,
    lastVerdict: null,
    latestDecisionLogId: null,
    lastDeskRunId: null,
    risk: {
      liveLocked: true,
      testnetStatus: "Binance Testnet is not connected yet.",
      blocker: null,
    },
    trust: {
      completedTrades: 0,
      minRequired: GOAL_MIN_TRADES_FOR_TRUST,
      ready: false,
    },
    nextRecommendation: "Connect Binance Testnet — autopilot will analyze, trade, and learn on schedule.",
    scopeLabel: "Paper + Testnet (practice money)",
    enginesNeedingAttention: 0,
    learnedTrades: 0,
    pendingLearningReview: 0,
    learningPending: [],
    automation: {
      enabled: true,
      paused: false,
      intervalMinutes: 15,
      lastRunAt: null,
      nextRunAt: null,
      lastRunStatus: null,
      lastTrigger: null,
      autoExecuteEnabled: false,
      autoLearnEnabled: false,
    },
    notifications: {
      telegramConfigured: false,
      notifyOnTrade: true,
      notifyOnBlocker: true,
      lastAlertAt: null,
    },
    recentActivity: [],
    learningInsights: {
      learnedCount: 0,
      winCount: 0,
      lossCount: 0,
      avgR: null,
      recent: [],
    },
    strategyHealth: null,
    trustNotionalUsd: 55,
    evidenceProgress: emptyEvidenceProgress(),
    monitorReliability: emptyMonitorReliabilitySnapshot(),
    learningProgress: emptyLearningProgress(),
    integratedStrategyHealth: emptyIntegratedStrategyHealth(),
    microLiveReadiness: emptyMicroLiveReadiness(),
    integratedTradeQuality: emptyIntegratedTradeQuality(),
    integratedConfidenceCalibration: emptyIntegratedConfidenceCalibration(),
    integratedRiskBudget: emptyIntegratedRiskBudget(),
    integratedDailySelfReview: emptyIntegratedDailySelfReview(),
    evidenceQuality: emptyEvidenceQualitySnapshot(),
    integratedQualityCalibration: emptyIntegratedQualityCalibration(),
    integratedStrategyAgentHealth: emptyIntegratedStrategyAgentHealth(),
    missionControllerRiskBudget: emptyMissionControllerRiskBudget(),
    engineConsistency: emptyEngineConsistencySnapshot(),
    alwaysOnOperatorLayer: emptyAlwaysOnOperatorLayer(),
    microLiveReadinessReview: emptyMicroLiveReadinessReview(),
    selfLearning: {
      serverEvaluated: 0,
      lastTopAgent: null,
      lastEvaluatedAt: null,
    },
  };
}
