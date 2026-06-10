import type { GoalDashboardServerPayload } from "@/lib/goal-engine/build-server-context";
import type { GoalNotificationPrefs } from "@/lib/mission-notifications/goal-notification-store";
import { emptyEvidenceProgress } from "@/lib/evidence-progress";
import { emptyLearningProgress } from "@/lib/learning-queue/empty-snapshot";
import { emptyIntegratedStrategyHealth } from "@/lib/integrated-strategy-health/empty-snapshot";
import {
  resolveAiNextActionFromIntegrated,
  resolveMissionStrategyHealthFromIntegrated,
} from "@/lib/integrated-strategy-health/map-mission-health";
import { emptyMicroLiveReadiness } from "@/lib/micro-live-readiness/empty-snapshot";
import { emptyIntegratedTradeQuality } from "@/lib/trade-quality-score/empty-snapshot";
import { emptyIntegratedConfidenceCalibration } from "@/lib/integrated-confidence-calibration/empty-snapshot";
import { emptyIntegratedRiskBudget } from "@/lib/integrated-risk-budget/empty-snapshot";
import { emptyIntegratedDailySelfReview } from "@/lib/integrated-daily-self-review/empty-snapshot";
import { emptyEvidenceQualitySnapshot } from "@/lib/evidence-quality/build-evidence-quality";
import { emptyIntegratedQualityCalibration } from "@/lib/integrated-quality-calibration/build-integrated-quality-calibration";
import { emptyIntegratedStrategyAgentHealth } from "@/lib/integrated-strategy-agent-health/build-integrated-strategy-agent-health";
import { emptyEngineConsistencySnapshot } from "@/lib/engine-consistency/empty-engine-consistency";
import { emptyMissionControllerRiskBudget } from "@/lib/mission-controller-risk-budget/empty-snapshot";
import { emptyAlwaysOnOperatorLayer } from "@/lib/always-on-operator-layer/empty-snapshot";
import { emptyMicroLiveReadinessReview } from "@/lib/micro-live-readiness-review/empty-snapshot";
import { resolveAiNextActionChain } from "@/lib/integrated-daily-self-review/map-mission-action";
import { emptyMonitorReliabilitySnapshot } from "@/lib/monitor-reliability/empty-snapshot";
import { resolveTrustScaledNotionalUsd } from "@/lib/exchange/binance/trust-scaled-notional";
import { loadBinanceConfig } from "@/lib/exchange/binance/binance-config";
import { resolveBinanceTestnetDiagnosticFromStatus } from "@/lib/testnet-engine-activation/build-binance-testnet-diagnostic";
import type { BinanceTestnetDiagnosticSnapshot } from "@/lib/testnet-engine-activation/types";
import type { BinanceStatusResult } from "@/lib/exchange/binance/binance-types";
import { resolvePrimaryStrategyHealth } from "./resolve-primary-strategy-health";
import type { MissionFlowSelfLearning } from "./types";
import type {
  MissionFlowActivityItem,
  MissionFlowLearningInsights,
  MissionFlowPendingPreview,
  MissionFlowSnapshot,
  MissionFlowStrategyHealth,
} from "./types";

function legacyBinanceToStatus(
  binance: GoalDashboardServerPayload["binance"],
): BinanceStatusResult {
  return {
    configured: binance.configured,
    testnetEnabled: binance.testnetEnabled,
    liveEnabled: false,
    liveBlocked: binance.liveLocked,
    baseUrl: binance.baseUrl,
    upstreamBaseUrl: binance.upstreamBaseUrl,
    proxyEnabled: binance.proxyEnabled,
    autoExecuteEnabled: binance.autoExecuteEnabled,
    allowedSymbols: ["BTCUSDT"],
    connected: binance.connected,
    serverTimeMs: binance.connected ? Date.now() : null,
    clockSkewMs: null,
    safetyNotice: "Testnet only",
    error: binance.error,
    envChecklist: [],
    blockers: binance.blocker
      ? [{ category: "API_ERROR", detail: binance.blocker }]
      : [],
  };
}

function resolvePayloadBinanceDiagnostic(
  payload: GoalDashboardServerPayload,
): BinanceTestnetDiagnosticSnapshot {
  if (payload.binanceDiagnostic) return payload.binanceDiagnostic;
  return resolveBinanceTestnetDiagnosticFromStatus(
    legacyBinanceToStatus(payload.binance),
  );
}

function mapBinanceTestnetFromPayload(
  payload: GoalDashboardServerPayload,
): MissionFlowSnapshot["binanceTestnet"] {
  const d = resolvePayloadBinanceDiagnostic(payload);
  return {
    status: d.status,
    reason: d.reason,
    recommendation: d.recommendation,
    lastCheckedAt: d.lastCheckedAt,
    connected: d.connected,
    testnetEnabled: d.testnetEnabled,
    liveEnabled: d.liveEnabled,
    proxyEnabled: d.proxyEnabled,
    proxyProvider: d.proxyProvider,
    proxyUrlConfigured: d.proxyUrlConfigured,
    apiKeyPresent: d.apiKeyPresent,
    apiSecretPresent: d.apiSecretPresent,
    baseUrl: d.baseUrl,
  };
}

function resolveBinanceFlowStatusLegacy(
  binance: GoalDashboardServerPayload["binance"],
): { status: "CONNECTED" | "DISCONNECTED"; reason: string } {
  if (!binance.configured) {
    return {
      status: "DISCONNECTED",
      reason: "Missing BINANCE_API_KEY / BINANCE_API_SECRET in server env.",
    };
  }
  if (binance.connected) {
    return { status: "CONNECTED", reason: "connected" };
  }
  return {
    status: "DISCONNECTED",
    reason: binance.error ?? binance.blocker ?? "API keys configured but not connected.",
  };
}

function buildNextRecommendation(
  payload: GoalDashboardServerPayload,
  pendingTestnetPreview: MissionFlowPendingPreview | null,
): string {
  const { goal, mission, binance } = payload;
  const binanceFlow = resolveBinanceFlowStatusLegacy(binance);

  const diagnostic = resolvePayloadBinanceDiagnostic(payload);
  if (diagnostic.status !== "CONNECTED") {
    return diagnostic.recommendation;
  }
  if (pendingTestnetPreview && !pendingTestnetPreview.blocked) {
    return `Review testnet order: ${pendingTestnetPreview.symbol} ${pendingTestnetPreview.side} · double confirm required.`;
  }
  const autoExec = Boolean(binance.autoExecuteEnabled);
  if (mission.totalTrades === 0 && !goal.lastCycleAt) {
    return autoExec
      ? "Autopilot will run the first cycle on schedule — or tap Run cycle now."
      : "Autopilot analyzes every 15 min — enable auto-execute for hands-off testnet trades.";
  }
  if (mission.totalTrades === 0 && goal.lastCycleAt) {
    return autoExec
      ? "Autopilot is running — waiting for a TRADE setup on testnet."
      : "Cycle complete — waiting for TRADE verdict (manual confirm) or enable auto-execute.";
  }
  if (!mission.trustReady) {
    return `${mission.totalTrades} / ${mission.minTradesForTrust} completed trades — keep AI running on testnet.`;
  }
  if (mission.pendingLearningReview > 0) {
    return autoExec
      ? `${mission.pendingLearningReview} trade(s) queued for learning — autopilot will ingest on next cycle.`
      : `Review ${mission.pendingLearningReview} closed trade(s) so AI can learn.`;
  }
  const strategyHealthHint = resolvePrimaryStrategyHealth(payload.strategyHealth);
  if (strategyHealthHint && !strategyHealthHint.tradeAllowed && strategyHealthHint.blockReason) {
    return strategyHealthHint.blockReason;
  }
  if (goal.risk.blocker) {
    return `Clear blocker: ${goal.risk.blocker}`;
  }
  if (payload.automation?.state.settings.paused) {
    return "Background autopilot is paused — resume on AI Status.";
  }
  if (payload.automation?.state.settings.automationEnabled === false) {
    return "Enable scheduled AI cycles on AI Status or Settings.";
  }
  if (goal.aiActivity.status === "WAITING") {
    return "Resume AI autopilot when ready.";
  }
  return goal.primaryCta.description || mission.nextAction;
}

const EMPTY_LEARNING_INSIGHTS: MissionFlowLearningInsights = {
  learnedCount: 0,
  winCount: 0,
  lossCount: 0,
  avgR: null,
  recent: [],
};

export function buildMissionFlowSnapshot(
  payload: GoalDashboardServerPayload,
  latestDecisionLogId: string | null,
  openTrades: number,
  pendingTestnetPreview: MissionFlowPendingPreview | null = null,
  notificationPrefs?: GoalNotificationPrefs,
  extras?: {
    recentActivity?: MissionFlowActivityItem[];
    learningInsights?: MissionFlowLearningInsights;
    strategyHealth?: MissionFlowStrategyHealth | null;
    selfLearning?: MissionFlowSelfLearning;
  },
): MissionFlowSnapshot {
  const { goal, mission, binance, engines, automation, learningPending } = payload;
  const settings = automation?.state.settings;
  const lastRun = automation?.state.lastRun;

  const currentPosition = goal.currentPosition
    ? {
        environment: goal.currentPosition.environment,
        symbol: goal.currentPosition.symbol,
        side: goal.currentPosition.side,
        entryPrice: goal.currentPosition.entryPrice,
        markPrice: goal.currentPosition.markPrice,
        unrealizedPnlUsd: goal.currentPosition.unrealizedPnlUsd,
        summary:
          mission.currentPositionSummary ??
          `${goal.currentPosition.symbol} ${goal.currentPosition.side}`,
        canCloseOnTestnet: goal.currentPosition.canCloseOnTestnet,
      }
    : null;

  const hasCycle = Boolean(
    goal.lastCycleAt ||
      mission.lastDeskRunId ||
      automation?.state.lastSuccessfulRunAt ||
      automation?.state.lastRun?.completedAt,
  );

  const evidence =
    payload.testnetSnapshot?.evidenceProgress ?? emptyEvidenceProgress();
  const monitorReliability =
    payload.testnetSnapshot?.monitorReliability ?? emptyMonitorReliabilitySnapshot();
  const learningProgress =
    payload.testnetSnapshot?.learningProgress ?? emptyLearningProgress();
  const integratedStrategyHealth =
    payload.testnetSnapshot?.integratedStrategyHealth ??
    emptyIntegratedStrategyHealth();
  const microLiveReadiness =
    payload.testnetSnapshot?.microLiveReadiness ?? emptyMicroLiveReadiness();
  const integratedTradeQuality =
    payload.testnetSnapshot?.integratedTradeQuality ?? emptyIntegratedTradeQuality();
  const integratedConfidenceCalibration =
    payload.testnetSnapshot?.integratedConfidenceCalibration ??
    emptyIntegratedConfidenceCalibration();
  const integratedRiskBudget =
    payload.testnetSnapshot?.integratedRiskBudget ?? emptyIntegratedRiskBudget();
  const integratedDailySelfReview =
    payload.testnetSnapshot?.integratedDailySelfReview ?? emptyIntegratedDailySelfReview();
  const evidenceQuality =
    payload.testnetSnapshot?.evidenceQuality ?? emptyEvidenceQualitySnapshot();
  const integratedQualityCalibration =
    payload.testnetSnapshot?.integratedQualityCalibration ??
    emptyIntegratedQualityCalibration();
  const integratedStrategyAgentHealth =
    payload.testnetSnapshot?.integratedStrategyAgentHealth ??
    emptyIntegratedStrategyAgentHealth();
  const missionControllerRiskBudget =
    payload.testnetSnapshot?.missionControllerRiskBudget ??
    emptyMissionControllerRiskBudget();
  const engineConsistency =
    payload.testnetSnapshot?.engineConsistency ?? emptyEngineConsistencySnapshot();
  const alwaysOnOperatorLayer =
    payload.testnetSnapshot?.alwaysOnOperatorLayer ?? emptyAlwaysOnOperatorLayer();
  const microLiveReadinessReview =
    payload.testnetSnapshot?.microLiveReadinessReview ??
    emptyMicroLiveReadinessReview();
  const resolvedStrategyHealth = resolveMissionStrategyHealthFromIntegrated(
    integratedStrategyHealth,
    extras?.strategyHealth ?? null,
  );
  const aiNextAction = pendingTestnetPreview && !pendingTestnetPreview.blocked
    ? `Double-confirm testnet ${pendingTestnetPreview.symbol} ${pendingTestnetPreview.side} order.`
    : resolveAiNextActionChain({
        microLiveReadiness,
        dailyReview: integratedDailySelfReview,
        integratedFallback: resolveAiNextActionFromIntegrated(
          integratedStrategyHealth,
          mission.nextAction,
        ),
      });

  return {
    startCapital: mission.startCapital,
    targetCapital: mission.targetCapital,
    currentEquity: mission.currentEquity,
    progressPct: mission.progressPct,
    remainingToTarget: mission.remainingToTarget,
    netPnl: mission.netPnl,
    realizedPnl: mission.realizedPnl,
    unrealizedPnl: mission.unrealizedPnl,
    totalTrades: mission.totalTrades,
    openTrades,
    closedTrades: mission.totalTrades,
    wins: mission.winTrades,
    losses: mission.lossTrades,
    breakeven: mission.breakevenTrades,
    winRate: mission.totalTrades > 0 ? mission.winRate : null,
    maxDrawdown: goal.tradeStats.maxDrawdown,
    currentPosition,
    pendingTestnetPreview,
    aiStatus: {
      state: hasCycle ? mission.aiStatus : "MONITORING",
      lastAction: hasCycle
        ? goal.aiActivity.lastAction
        : "Autopilot scheduled — first cycle starting soon.",
      nextAction: aiNextAction,
      humanActionRequired:
        mission.humanActionRequired ||
        Boolean(pendingTestnetPreview && !pendingTestnetPreview.blocked),
    },
    binanceTestnet: mapBinanceTestnetFromPayload(payload),
    lastUpdatedAt: mission.lastUpdatedAt,
    lastCycleAt: mission.lastCycleAt,
    lastVerdict: mission.lastVerdict,
    latestDecisionLogId,
    lastDeskRunId: mission.lastDeskRunId,
    risk: {
      liveLocked: goal.risk.liveLocked,
      testnetStatus: goal.risk.testnetStatus,
      blocker: goal.risk.blocker,
    },
    trust: {
      completedTrades: evidence.completedTrades,
      minRequired: evidence.requiredTrades,
      ready: evidence.evidenceSetReady,
    },
    nextRecommendation: buildNextRecommendation(payload, pendingTestnetPreview),
    scopeLabel: mission.scopeLabel,
    enginesNeedingAttention: engines.visibleEngines.length,
    learnedTrades: mission.learnedTrades,
    pendingLearningReview: mission.pendingLearningReview,
    learningPending: learningPending.slice(0, 5).map((r) => ({
      learningRecordId: r.learningRecordId,
      symbol: r.symbol,
      netPnl: r.netPnl,
      result: r.result,
      updatedAt: r.updatedAt,
    })),
    automation: {
      enabled: settings?.automationEnabled ?? true,
      paused: settings?.paused ?? false,
      intervalMinutes: settings?.intervalMinutes ?? 15,
      lastRunAt:
        lastRun?.completedAt ??
        settings?.lastRunAt ??
        automation?.state.lastSuccessfulRunAt ??
        null,
      nextRunAt: automation?.state.nextRunAt ?? settings?.nextRunAt ?? null,
      lastRunStatus: lastRun?.status ?? null,
      lastTrigger: lastRun?.trigger ?? null,
      autoExecuteEnabled: Boolean(binance.autoExecuteEnabled),
      autoLearnEnabled: Boolean(binance.autoExecuteEnabled),
    },
    notifications: {
      telegramConfigured: payload.telegramConfigured,
      notifyOnTrade: notificationPrefs?.notifyOnTrade ?? true,
      notifyOnBlocker: notificationPrefs?.notifyOnBlocker ?? true,
      lastAlertAt: notificationPrefs?.lastAlertAt ?? null,
    },
    recentActivity: extras?.recentActivity ?? [],
    learningInsights: extras?.learningInsights ?? EMPTY_LEARNING_INSIGHTS,
    strategyHealth: resolvedStrategyHealth,
    trustNotionalUsd: resolveTrustScaledNotionalUsd({
      completedTrades: evidence.completedTrades,
      minRequired: evidence.requiredTrades,
      maxNotionalUsd: loadBinanceConfig().maxNotionalUsd,
    }),
    evidenceProgress: evidence,
    monitorReliability,
    learningProgress,
    integratedStrategyHealth,
    microLiveReadiness,
    integratedTradeQuality,
    integratedConfidenceCalibration,
    integratedRiskBudget,
    integratedDailySelfReview,
    evidenceQuality,
    integratedQualityCalibration,
    integratedStrategyAgentHealth,
    missionControllerRiskBudget,
    engineConsistency,
    alwaysOnOperatorLayer,
    microLiveReadinessReview,
    selfLearning: extras?.selfLearning ?? {
      serverEvaluated: 0,
      lastTopAgent: null,
      lastEvaluatedAt: null,
    },
  };
}
