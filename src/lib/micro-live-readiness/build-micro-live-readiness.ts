import { blockBinanceProductionOrder, loadBinanceConfig } from "@/lib/exchange/binance/binance-config";
import { liveExecutionStatus } from "@/lib/exchange/live-execution-gate";
import { VALIDATION_THRESHOLDS } from "@/lib/validation/validation-config";
import { buildMicroLiveReadinessReport } from "./build-readiness-report";
import { applyMicroLiveReadinessSideEffects } from "./persist-readiness-check";
import type {
  MicroLiveReadinessBuildInput,
  MicroLiveReadinessSnapshot,
} from "./types";
import {
  MICRO_LIVE_READINESS_LABEL,
  MICRO_LIVE_READINESS_MVP,
} from "./types";

export async function buildMicroLiveReadiness(
  input: MicroLiveReadinessBuildInput,
): Promise<MicroLiveReadinessSnapshot> {
  const report = buildMicroLiveReadinessReport(input);
  let governanceWarningActive = report.readinessStatus === "BLOCKED";

  if (input.persistSideEffects) {
    const effects = await applyMicroLiveReadinessSideEffects({ report });
    governanceWarningActive =
      governanceWarningActive || effects.governanceCreated;
  }

  return {
    mvp: MICRO_LIVE_READINESS_MVP,
    label: MICRO_LIVE_READINESS_LABEL,
    readinessStatus: report.readinessStatus,
    readinessScore: report.readinessScore,
    report,
    liveTradingLocked: true,
    liveExecutionEnabled: input.liveExecutionEnabled,
    topBlocker: report.blockers[0] ?? null,
    governanceWarningActive,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function buildMicroLiveReadinessDefaults(input: {
  connected: boolean;
  testnetConfigured: boolean;
  evidenceProgress: import("@/lib/evidence-progress/types").EvidenceProgressSnapshot;
  journal: import("@/lib/exchange/binance/binance-types").BinanceTestnetJournalEntry[];
  learningRecords: import("@/lib/testnet-monitor/types").TestnetLearningRecord[];
  monitorEvents: import("@/lib/testnet-monitor/types").TestnetMonitorJournalEvent[];
  killSwitchPaused?: boolean;
  riskBlockNewTrades?: boolean;
  criticalIncidentOpen?: boolean;
  criticalIncidentTitle?: string | null;
  persistSideEffects?: boolean;
}): MicroLiveReadinessBuildInput {
  const config = loadBinanceConfig();
  const live = liveExecutionStatus();
  const liveBlock = blockBinanceProductionOrder();
  const pending = input.learningRecords.filter(
    (r) => r.status === "PENDING_REVIEW" || r.status === "REFLECTION_READY",
  ).length;

  return {
    connected: input.connected,
    testnetConfigured: input.testnetConfigured,
    evidenceCompletedTrades: input.evidenceProgress.completedTrades,
    evidenceValidTrades: input.evidenceProgress.validTrades,
    evidenceExcluded: input.evidenceProgress.excludedTrades,
    evidenceMissingDecisionLogId: input.evidenceProgress.missingDecisionLogId,
    evidenceMissingCloseJournal: input.evidenceProgress.missingCloseJournal,
    evidenceMissingPnl: input.evidenceProgress.missingPnl,
    journal: input.journal,
    learningRecords: input.learningRecords,
    learningPendingCount: pending,
    monitorEvents: input.monitorEvents,
    requireDoubleConfirm: config.requireDoubleConfirm,
    liveExecutionEnabled: live.enabled,
    liveBlocked: Boolean(liveBlock) || !live.enabled,
    killSwitchConfigured: Number.isFinite(VALIDATION_THRESHOLDS.dailyLossLimitPct),
    killSwitchPaused: input.killSwitchPaused ?? false,
    criticalIncidentOpen: input.criticalIncidentOpen ?? false,
    criticalIncidentTitle: input.criticalIncidentTitle ?? null,
    riskBlockNewTrades: input.riskBlockNewTrades ?? false,
    persistSideEffects: input.persistSideEffects,
  };
}
