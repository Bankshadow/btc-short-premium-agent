import { loadServerPendingOperatorActions } from "@/lib/automation-control-plane/state-store";
import { loadServerAnalysisJournal } from "@/lib/journal/journal-server-store";
import { buildStrategyHealthSummary } from "@/lib/strategy-health";
import { buildStrategyHealthInputServer } from "@/lib/strategy-health/build-server-context";
import { buildProjectStrategistContext } from "@/lib/project-strategist/project-context";
import { getProjectStrategistStatus } from "@/lib/project-strategist";
import { loadServerBinanceTestnetJournal } from "@/lib/exchange/binance/binance-testnet-journal-server";
import { buildExecutionQualitySummary } from "@/lib/execution-quality";
import { getSecondBrainDashboardSnapshot } from "@/lib/second-brain/prepare-cycle";
import { getLoopGuardDashboardSnapshot } from "@/lib/autopilot-loop-guard/run-guard";
import { evaluateRealTimeRisk } from "@/lib/real-time-risk/evaluate-realtime-risk";
import { loadLearningRecordsServer } from "@/lib/testnet-monitor/learning-records-server";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";

export interface ParallelReviewContext {
  workspaceId: string;
  entries: DecisionLogEntry[];
  orders: PaperOrder[];
  riskProfile: DeskRiskProfile;
  strategistContext: Awaited<ReturnType<typeof buildProjectStrategistContext>> | null;
  strategistStatus: Awaited<ReturnType<typeof getProjectStrategistStatus>> | null;
  strategyHealth: ReturnType<typeof buildStrategyHealthSummary>;
  riskReport: ReturnType<typeof evaluateRealTimeRisk>;
  loopGuard: Awaited<ReturnType<typeof getLoopGuardDashboardSnapshot>> | null;
  executionQuality: ReturnType<typeof buildExecutionQualitySummary>;
  secondBrain: Awaited<ReturnType<typeof getSecondBrainDashboardSnapshot>> | null;
  pendingLearning: number;
  pendingOperatorActions: number;
}

export async function buildParallelReviewContext(input: {
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
  riskProfile: DeskRiskProfile;
  workspaceId?: string;
}): Promise<ParallelReviewContext> {
  const workspaceId = input.workspaceId ?? "server-default";
  const entries = input.entries?.length
    ? input.entries
    : await loadServerAnalysisJournal().catch(() => []);
  const orders = input.orders ?? [];

  const [
    strategistContext,
    strategistStatus,
    journal,
    loopGuard,
    secondBrain,
    learningRecords,
    pendingActions,
  ] = await Promise.all([
    buildProjectStrategistContext().catch(() => null),
    getProjectStrategistStatus(workspaceId).catch(() => null),
    loadServerBinanceTestnetJournal().catch(() => []),
    getLoopGuardDashboardSnapshot(workspaceId).catch(() => null),
    getSecondBrainDashboardSnapshot(workspaceId).catch(() => null),
    loadLearningRecordsServer().catch(() => []),
    loadServerPendingOperatorActions().catch(() => []),
  ]);

  const strategyHealthInput = await buildStrategyHealthInputServer().catch(() => ({
    entries,
    orders,
    unifiedPortfolio: null,
    testnetSnapshot: null,
    liveTrades: [],
  }));
  const strategyHealth = buildStrategyHealthSummary(strategyHealthInput);
  const riskReport = evaluateRealTimeRisk({ entries, orders });
  const executionQuality = buildExecutionQualitySummary({ testnetJournal: journal });

  return {
    workspaceId,
    entries,
    orders,
    riskProfile: input.riskProfile,
    strategistContext,
    strategistStatus,
    strategyHealth,
    riskReport,
    loopGuard,
    executionQuality,
    secondBrain,
    pendingLearning: learningRecords.filter((r) => r.status === "PENDING_REVIEW").length,
    pendingOperatorActions: pendingActions.length,
  };
}
