import { blockBinanceProductionOrder, loadBinanceConfig } from "@/lib/exchange/binance/binance-config";
import { liveExecutionStatus } from "@/lib/exchange/live-execution-gate";
import type { AlwaysOnOperatorLayerSnapshot } from "@/lib/always-on-operator-layer/types";
import type { EvidenceProgressSnapshot } from "@/lib/evidence-progress/types";
import type { EvidenceQualitySnapshot } from "@/lib/evidence-quality/types";
import type { IntegratedRiskBudgetSnapshot } from "@/lib/integrated-risk-budget/types";
import type { IntegratedStrategyHealthSnapshot } from "@/lib/integrated-strategy-health/types";
import type { MicroLiveReadinessSnapshot } from "@/lib/micro-live-readiness/types";
import type { MonitorReliabilitySnapshot } from "@/lib/monitor-reliability/types";
import { isTelegramControlEnabled } from "@/lib/telegram-control-channel/config";
import { VALIDATION_THRESHOLDS } from "@/lib/validation/validation-config";
import {
  buildReadinessReviewChecklist,
  resolveReadinessReviewStatus,
  scoreReadinessReview,
} from "./build-readiness-review-checklist";
import type { MicroLiveReadinessReviewSnapshot } from "./types";
import {
  MICRO_LIVE_READINESS_REVIEW_LABEL,
  MICRO_LIVE_READINESS_REVIEW_MVP,
  READINESS_REVIEW_SAFETY_NOTICE,
} from "./types";

function isTelegramAlertReady(): boolean {
  return Boolean(
    process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim(),
  );
}

export function buildMicroLiveReadinessReviewFromSnapshots(input: {
  connected: boolean;
  testnetConfigured: boolean;
  evidenceProgress: EvidenceProgressSnapshot;
  evidenceQuality: EvidenceQualitySnapshot;
  integratedStrategyHealth: IntegratedStrategyHealthSnapshot;
  integratedRiskBudget: IntegratedRiskBudgetSnapshot;
  monitorReliability: MonitorReliabilitySnapshot;
  microLiveReadiness: MicroLiveReadinessSnapshot;
  alwaysOnOperatorLayer?: AlwaysOnOperatorLayerSnapshot | null;
  killSwitchPaused?: boolean;
  criticalIncidentOpen?: boolean;
  criticalIncidentTitle?: string | null;
  learningPendingCount?: number;
}): MicroLiveReadinessReviewSnapshot {
  const config = loadBinanceConfig();
  const live = liveExecutionStatus();
  const liveBlock = blockBinanceProductionOrder();
  const legacy = input.microLiveReadiness.report;

  const reduceOnlyItem = legacy.checklist.find(
    (c) => c.id === "reduce_only_close",
  );
  const auditItem = legacy.checklist.find((c) => c.id === "learning_records");
  const closedJournalItem = legacy.checklist.find((c) => c.id === "closed_journal");
  const pnlItem = legacy.checklist.find((c) => c.id === "realized_pnl");

  const rec = input.integratedRiskBudget.recommendation;
  const strategyStatus =
    input.integratedStrategyHealth.primaryReport?.status ?? null;

  const buildInput = {
    connected: input.connected,
    testnetConfigured: input.testnetConfigured,
    liveExecutionEnabled: live.enabled,
    liveBlocked: Boolean(liveBlock) || !live.enabled,
    requireDoubleConfirm: config.requireDoubleConfirm,
    killSwitchConfigured: Number.isFinite(VALIDATION_THRESHOLDS.dailyLossLimitPct),
    killSwitchPaused: input.killSwitchPaused ?? false,
    criticalIncidentOpen: input.criticalIncidentOpen ?? false,
    criticalIncidentTitle: input.criticalIncidentTitle ?? null,
    evidenceValidCount: input.evidenceProgress.validTrades.length,
    evidenceMissingDecisionLogId: input.evidenceProgress.missingDecisionLogId,
    evidenceMissingCloseJournal: input.evidenceProgress.missingCloseJournal,
    evidenceMissingPnl: input.evidenceProgress.missingPnl,
    evidenceQualityPassed: !input.evidenceQuality.blocksStrategyHealthReview,
    evidenceQualityBlockReason: input.evidenceQuality.blockReason,
    strategyHealthStatus: strategyStatus,
    strategyBlocksEntries: input.integratedStrategyHealth.blocksNewTestnetEntries,
    monitorHealthOk: input.monitorReliability.health !== "BLOCKED",
    monitorPositionUncertain: input.monitorReliability.positionStateUncertain,
    monitorCurrentIssue: input.monitorReliability.currentIssue,
    riskBudgetConfigured:
      rec.currentMaxNotional > 0 && rec.recommendedMaxNotional > 0,
    dailyLossLimitConfigured:
      Math.abs(rec.currentDailyLossLimitPct) > 0 ||
      Math.abs(rec.recommendedDailyLossLimit) > 0,
    reduceOnlyCloseTested: reduceOnlyItem?.passed ?? false,
    auditTrailComplete:
      Boolean(closedJournalItem?.passed) &&
      Boolean(pnlItem?.passed) &&
      Boolean(auditItem?.passed) &&
      input.evidenceProgress.missingDecisionLogId === 0,
    telegramOrOperatorReady:
      isTelegramControlEnabled() ||
      isTelegramAlertReady() ||
      (input.alwaysOnOperatorLayer?.heartbeat.tickCount ?? 0) > 0,
    learningPendingCount: input.learningPendingCount ?? 0,
  };

  const checklist = buildReadinessReviewChecklist(buildInput);
  const blockers = checklist
    .filter((c) => !c.passed && c.hardBlock)
    .map((c) => c.detail ?? c.label);
  const warnings = checklist
    .filter((c) => !c.passed && !c.hardBlock)
    .map((c) => c.detail ?? c.label);

  if (buildInput.learningPendingCount > 0) {
    warnings.push(
      `${buildInput.learningPendingCount} learning record(s) pending review.`,
    );
  }

  const readinessStatus = resolveReadinessReviewStatus({
    checklist,
    liveExecutionEnabled: buildInput.liveExecutionEnabled,
    liveBlocked: buildInput.liveBlocked,
    criticalIncidentOpen: buildInput.criticalIncidentOpen,
  });

  const readinessScore = scoreReadinessReview(checklist);

  const nextActions =
    blockers.length > 0
      ? blockers.slice(0, 6)
      : warnings.length > 0
        ? warnings.slice(0, 4)
        : readinessStatus === "READY_FOR_REVIEW"
          ? [
              "All checklist items passed — schedule human micro-live review (live stays locked).",
            ]
          : ["Complete remaining readiness checklist items on testnet."];

  return {
    mvp: MICRO_LIVE_READINESS_REVIEW_MVP,
    label: MICRO_LIVE_READINESS_REVIEW_LABEL,
    readinessStatus,
    readinessScore,
    checklist,
    blockers,
    warnings,
    nextActions,
    topBlocker: blockers[0] ?? null,
    cannotEnableLive: true,
    cannotPlaceLiveOrders: true,
    liveTradingLocked: true,
    safetyNotice: READINESS_REVIEW_SAFETY_NOTICE,
    lastUpdatedAt: new Date().toISOString(),
  };
}
