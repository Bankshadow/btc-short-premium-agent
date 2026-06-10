import {
  getBinanceStatus,
  getOpenOrders,
  getPositions,
} from "@/lib/exchange/binance/binance-futures-testnet";
import { loadBinanceConfig, blockBinanceProductionOrder } from "@/lib/exchange/binance/binance-config";
import type { BinanceOpenOrder, BinancePosition } from "@/lib/exchange/binance/binance-types";
import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import { loadServerBinanceTestnetJournal, saveServerBinanceTestnetJournal } from "@/lib/exchange/binance/binance-testnet-journal-server";
import { backfillOrphanBinanceJournalEntries } from "@/lib/exchange/binance/binance-journal-backfill";
import { reconcileBinanceJournalStatuses } from "@/lib/exchange/binance/binance-journal-reconcile";
import { reconcileBinancePositions } from "@/lib/exchange/binance/binance-position-monitor";
import { buildEvidenceProgress } from "@/lib/evidence-progress";
import { buildEvidenceQualitySnapshot } from "@/lib/evidence-quality/build-evidence-quality";
import { buildLearningProgress } from "@/lib/learning-queue";
import { buildIntegratedStrategyHealth } from "@/lib/integrated-strategy-health";
import {
  buildMicroLiveReadiness,
  buildMicroLiveReadinessDefaults,
} from "@/lib/micro-live-readiness";
import { isMissionPausingCriticalIncident } from "@/lib/anomaly-detection/testnet-gate";
import { loadAnomalyIncidents } from "@/lib/anomaly-detection/store";
import { loadMonitorJournalEvents } from "./monitor-journal-server";
import { loadServerAnalysisJournal } from "@/lib/journal/journal-server-store";
import {
  buildIntegratedTradeQualitySnapshot,
  syncTradeQualityFromClosedJournal,
} from "@/lib/trade-quality-score/sync-trade-quality-from-closed";
import { buildIntegratedConfidenceCalibration } from "@/lib/integrated-confidence-calibration";
import { buildIntegratedRiskBudget } from "@/lib/integrated-risk-budget";
import {
  buildMissionControllerRiskBudget,
  computeLosingStreakFromClosedTrades,
} from "@/lib/mission-controller-risk-budget";
import { buildAlwaysOnOperatorLayerSnapshot } from "@/lib/always-on-operator-layer/build-operator-layer-snapshot";
import { buildEngineConsistencyFromTestnet } from "@/lib/engine-consistency/build-engine-consistency-from-testnet";
import {
  buildMicroLiveReadinessReviewFromSnapshots,
  persistReadinessReviewSideEffects,
} from "@/lib/micro-live-readiness-review";
import { buildIntegratedDailySelfReviewSnapshot } from "@/lib/integrated-daily-self-review";
import { buildIntegratedQualityCalibration } from "@/lib/integrated-quality-calibration";
import { buildIntegratedStrategyAgentHealth } from "@/lib/integrated-strategy-agent-health";
import { GOAL_START_CAPITAL } from "@/lib/goal-engine/types";
import { buildMonitorReliabilitySnapshot } from "@/lib/monitor-reliability";
import { mapBinanceSource } from "./decision-linkage";
import { buildExecutionQualitySummary } from "@/lib/execution-quality";
import {
  buildAgentScoreboardSegmentFromRecords,
  buildLearningQueueFromRecords,
  buildStrategyPerformanceSegmentFromRecords,
  buildValidationMetricsSegmentFromRecords,
  syncLearningRecordsFromClosedTradesServer,
  saveLearningRecordsServer,
} from "./learning-records-server";
import {
  buildEquitySeries,
  calculateDailyPnl,
  calculateMaxDrawdown,
  calculateUnrealizedPnlPct,
  calculateWinRate,
  classifyTradeResult,
  groupPnlByStrategy,
  groupPnlBySymbol,
  sumRealizedPnl,
  sumUnrealizedPnl,
} from "./pnl";
import { withTestnetMonitorSnapshotDedup } from "./snapshot-cache";
import type {
  TestnetClosedTrade,
  TestnetMonitorSnapshot,
  TestnetMonitorSummary,
  TestnetOrder,
  TestnetPosition,
  TestnetPositionSide,
  TestnetRiskStatus,
} from "./types";

function positionSideFromAmt(amt: number): TestnetPositionSide {
  return amt >= 0 ? "LONG" : "SHORT";
}

function mapExchangePosition(
  pos: BinancePosition,
  journal: BinanceTestnetJournalEntry | undefined,
): TestnetPosition {
  const qty = Math.abs(Number(pos.positionAmt));
  const entry = Number(pos.entryPrice);
  const mark = Number(pos.markPrice);
  const side = positionSideFromAmt(Number(pos.positionAmt));
  const unrealized = Number(pos.unRealizedProfit);
  const notional = Math.abs(Number(pos.notional)) || qty * mark;
  const source = journal ? mapBinanceSource(journal.source) : "MANUAL_TEST";

  return {
    id: `pos-${pos.symbol}-${side}`,
    exchange: "BINANCE",
    symbol: pos.symbol,
    side,
    qty: String(qty),
    entryPrice: entry,
    markPrice: mark,
    liquidationPrice: null,
    leverage: Number(pos.leverage) || 1,
    margin: null,
    unrealizedPnl: unrealized,
    unrealizedPnlPct: calculateUnrealizedPnlPct(unrealized, notional),
    notionalUsd: notional,
    openedAt: journal?.executedAt ?? journal?.createdAt ?? new Date().toISOString(),
    decisionLogId: journal?.decisionLogId ?? null,
    source,
    strategy: journal?.source ?? null,
    aiVerdict: null,
    confidence: null,
    status: journal?.status === "CLOSING" ? "CLOSING" : "OPEN",
    previewId: journal?.previewId ?? null,
    journalTradeId: journal?.binanceTestnetTradeId ?? null,
  };
}

function mapExchangeOrder(
  order: BinanceOpenOrder,
  journal: BinanceTestnetJournalEntry | undefined,
): TestnetOrder {
  const source = journal ? mapBinanceSource(journal.source) : "MANUAL_TEST";
  return {
    id: String(order.orderId),
    exchange: "BINANCE",
    symbol: order.symbol,
    side: order.side,
    positionSide: order.side === "BUY" ? "LONG" : "SHORT",
    orderType: order.type,
    status: order.status,
    qty: order.origQty,
    avgFillPrice: Number(order.executedQty) > 0 ? null : null,
    fee: null,
    clientOrderId: null,
    exchangeOrderId: String(order.orderId),
    previewId: journal?.previewId ?? null,
    decisionLogId: journal?.decisionLogId ?? null,
    source,
    aiVerdict: null,
    confidence: null,
    strategy: journal?.source ?? null,
    createdAt: new Date(order.time).toISOString(),
    updatedAt: new Date(order.time).toISOString(),
  };
}

export function buildClosedTradesFromJournal(
  journal: BinanceTestnetJournalEntry[],
): TestnetClosedTrade[] {
  const closed: TestnetClosedTrade[] = [];
  for (const entry of journal) {
    if (entry.status !== "CLOSED" && !(entry.closedAt && entry.realizedPnl != null)) {
      continue;
    }
    const qty = Math.abs(Number(entry.quantity));
    const side: TestnetPositionSide =
      entry.side === "BUY" ? "LONG" : "SHORT";
    const fee = entry.fees ?? 0;
    const netPnl = entry.realizedPnl ?? 0;
    const grossPnl = netPnl + fee;
    const openedAt = entry.executedAt ?? entry.createdAt;
    const closedAt = entry.closedAt ?? entry.createdAt;
    const durationMs = Math.max(0, Date.parse(closedAt) - Date.parse(openedAt));

    closed.push({
      id: entry.binanceTestnetTradeId,
      exchange: "BINANCE",
      symbol: entry.symbol,
      side,
      entryPrice: 0,
      exitPrice: 0,
      qty: entry.quantity,
      grossPnl,
      fee,
      netPnl,
      rMultiple: null,
      result: classifyTradeResult(netPnl),
      durationMs,
      decisionLogId: entry.decisionLogId,
      strategy: entry.source,
      aiVerdict: null,
      confidence: null,
      openedAt,
      closedAt,
      notes: entry.operatorNote,
      learned: false,
      previewId: entry.previewId,
    });
  }
  return closed;
}

function resolveRiskStatus(input: {
  liveBlock: string | null;
  connected: boolean;
  mismatches: string[];
}): TestnetRiskStatus {
  if (input.liveBlock) return "BLOCKED";
  if (!input.connected) return "CAUTION";
  if (input.mismatches.length > 0) return "CAUTION";
  return "SAFE";
}

function buildSummary(input: {
  openPositions: TestnetPosition[];
  closedTrades: TestnetClosedTrade[];
  riskStatus: TestnetRiskStatus;
}): TestnetMonitorSummary {
  const totalUnrealized = sumUnrealizedPnl(input.openPositions);
  const totalRealized = sumRealizedPnl(input.closedTrades);
  const equitySeries = buildEquitySeries(
    input.closedTrades,
    input.openPositions,
  );
  const daily = calculateDailyPnl(input.closedTrades);
  const today = new Date().toISOString().slice(0, 10);
  const dailyPnl =
    daily.find((d) => d.date === today)?.netPnl ?? 0;

  return {
    openPositionCount: input.openPositions.length,
    totalUnrealizedPnl: totalUnrealized,
    totalRealizedPnl: totalRealized,
    netPnl: totalUnrealized + totalRealized,
    dailyPnl,
    winRate: calculateWinRate(input.closedTrades),
    tradeCount: input.closedTrades.length,
    winningTrades: input.closedTrades.filter((t) => t.result === "WIN").length,
    losingTrades: input.closedTrades.filter((t) => t.result === "LOSS").length,
    totalFees: input.closedTrades.reduce((s, t) => s + t.fee, 0),
    maxDrawdown: calculateMaxDrawdown(equitySeries),
    riskStatus: input.riskStatus,
    environment: "TESTNET",
    exchange: "BINANCE",
    liveTradingDisabled: true,
  };
}

export async function buildTestnetMonitorSnapshotUncached(): Promise<TestnetMonitorSnapshot> {
  const liveBlock = blockBinanceProductionOrder();
  const config = loadBinanceConfig();
  let connected = false;
  let positions: BinancePosition[] = [];
  let orders: BinanceOpenOrder[] = [];
  let mismatches: string[] = [];

  try {
    const status = await getBinanceStatus();
    connected = status.connected;
    if (!liveBlock && config.testnetEnabled) {
      [positions, orders] = await Promise.all([
        getPositions(),
        getOpenOrders(),
      ]);
    }
  } catch {
    connected = false;
  }

  let journal = await loadServerBinanceTestnetJournal();
  const journalBeforeReconcile = journal;
  journal = reconcileBinanceJournalStatuses(journal, positions);
  if (JSON.stringify(journal) !== JSON.stringify(journalBeforeReconcile)) {
    await saveServerBinanceTestnetJournal(journal);
  }
  const backfill = backfillOrphanBinanceJournalEntries({ positions, journal });
  if (backfill.backfilledSymbols.length > 0) {
    journal = backfill.journal;
    await saveServerBinanceTestnetJournal(journal);
  }
  const reconcile = reconcileBinancePositions({ positions, journal });
  mismatches = reconcile.mismatches;

  const journalBySymbol = new Map<string, BinanceTestnetJournalEntry>();
  for (const j of journal) {
    if (!journalBySymbol.has(j.symbol)) journalBySymbol.set(j.symbol, j);
  }

  const openPositions = positions
    .filter((p) => Math.abs(Number(p.positionAmt)) > 0)
    .map((p) => mapExchangePosition(p, journalBySymbol.get(p.symbol)));

  const openOrders = orders.map((o) =>
    mapExchangeOrder(o, journalBySymbol.get(o.symbol)),
  );

  const closedTrades = buildClosedTradesFromJournal(journal);
  const decisions = await loadServerAnalysisJournal().catch(() => []);
  let learningRecords = await syncLearningRecordsFromClosedTradesServer({
    closedTrades,
    journal,
    decisions,
  });
  const recordsBeforeQuality = learningRecords;
  const qualitySync = await syncTradeQualityFromClosedJournal({
    journal,
    closedTrades,
    decisions,
    learningRecords,
    persistEvents: true,
  });
  learningRecords = qualitySync.learningRecords;
  const qualityPersistNeeded =
    qualitySync.newlyScored > 0 ||
    qualitySync.learningRecords.some((r) => {
      const prev = recordsBeforeQuality.find(
        (p) =>
          (p.tradeId ?? p.closedTradeId) === (r.tradeId ?? r.closedTradeId),
      );
      return prev && r.qualityScoreId !== prev.qualityScoreId;
    });
  if (qualityPersistNeeded) {
    await saveLearningRecordsServer(learningRecords);
  }
  const integratedTradeQuality = buildIntegratedTradeQualitySnapshot({
    scores: qualitySync.scores,
  });
  const integratedConfidenceCalibration = await buildIntegratedConfidenceCalibration({
    journal,
    closedTrades,
    decisions,
    learningRecords,
    persistSideEffects: true,
  });
  const learningQueue = buildLearningQueueFromRecords(learningRecords);
  const agentScoreboardSegment =
    buildAgentScoreboardSegmentFromRecords(learningRecords);
  const strategyPerformanceSegment =
    buildStrategyPerformanceSegmentFromRecords(learningRecords);
  const validationMetricsSegment =
    buildValidationMetricsSegmentFromRecords(learningRecords);
  const executionQuality = buildExecutionQualitySummary({
    testnetJournal: journal,
  });
  const evidenceProgress = buildEvidenceProgress({
    journal,
    closedTrades,
    learningRecords,
    openPositionCount: openPositions.length,
    connected,
  });
  const learningProgress = buildLearningProgress({
    journal,
    learningRecords,
  });
  const monitorEventsForEvidence = await loadMonitorJournalEvents().catch(() => []);
  const evidenceQuality = buildEvidenceQualitySnapshot({
    journal,
    closedTrades,
    learningRecords,
    decisions,
    tradeQualityScores: qualitySync.scores,
    monitorEvents: monitorEventsForEvidence,
  });
  const integratedStrategyHealth = await buildIntegratedStrategyHealth({
    journal,
    closedTrades,
    learningRecords,
    decisions,
    evidenceCompletedTrades: evidenceQuality.validEvidenceCount,
    evidenceValidTrades: evidenceProgress.validTrades,
    tradeQualityScores: qualitySync.scores,
    agentScoreboardLearned: agentScoreboardSegment.totalLearned,
    confidenceCalibrationReport: integratedConfidenceCalibration.report,
    persistSideEffects: true,
    evidenceQuality,
  });
  const integratedQualityCalibration = buildIntegratedQualityCalibration({
    tradeQuality: integratedTradeQuality,
    confidenceCalibration: integratedConfidenceCalibration,
    strategyHealth: integratedStrategyHealth,
  });
  const integratedStrategyAgentHealth = buildIntegratedStrategyAgentHealth({
    journal,
    closedTrades,
    learningRecords,
    decisions,
    tradeQualityScores: qualitySync.scores,
    strategyHealth: integratedStrategyHealth,
    confidenceCalibrationReport: integratedConfidenceCalibration.report,
  });
  const [monitorEvents, incidents] = await Promise.all([
    monitorEventsForEvidence.length > 0
      ? Promise.resolve(monitorEventsForEvidence)
      : loadMonitorJournalEvents().catch(() => []),
    loadAnomalyIncidents().catch(() => []),
  ]);
  const criticalIncident = incidents.find((i) =>
    isMissionPausingCriticalIncident(i),
  );
  const microLiveReadiness = await buildMicroLiveReadiness(
    buildMicroLiveReadinessDefaults({
      connected,
      testnetConfigured: config.testnetEnabled,
      evidenceProgress,
      journal,
      learningRecords,
      monitorEvents,
      criticalIncidentOpen: Boolean(criticalIncident),
      criticalIncidentTitle: criticalIncident?.title ?? null,
      persistSideEffects: true,
    }),
  );
  const monitorReliability = await buildMonitorReliabilitySnapshot({
    journal,
    positions,
    connected,
    autoExecuteEnabled: true,
    autoRecover: true,
  });
  const equitySeries = buildEquitySeries(closedTrades, openPositions);
  const riskStatus = resolveRiskStatus({
    liveBlock,
    connected,
    mismatches,
  });
  const summary = buildSummary({ openPositions, closedTrades, riskStatus });

  const engineConsistency = await buildEngineConsistencyFromTestnet({
    connected,
    positions,
    journal,
    positionMismatches: mismatches,
    closedTrades,
    learningRecords,
    monitorEvents: monitorEventsForEvidence,
    decisions,
    dashboardNetPnl: summary.netPnl,
  });

  const integratedRiskBudget = await buildIntegratedRiskBudget({
    evidenceProgress,
    strategyHealth: integratedStrategyHealth,
    confidenceCalibration: integratedConfidenceCalibration,
    tradeQuality: integratedTradeQuality,
    microLiveReadiness,
    openPositionCount: openPositions.length,
    dailyPnlUsd: summary.dailyPnl,
    equityUsd: GOAL_START_CAPITAL + summary.netPnl,
    persistSideEffects: true,
    qualityCalibration: integratedQualityCalibration,
  });

  const integratedDailySelfReview = await buildIntegratedDailySelfReviewSnapshot({
    evidenceProgress,
    closedTrades,
    decisions,
    learningRecords,
    learningProgress,
    strategyHealth: integratedStrategyHealth,
    tradeQuality: integratedTradeQuality,
    confidenceCalibration: integratedConfidenceCalibration,
    riskBudget: integratedRiskBudget,
    executionQuality,
    monitorEvents,
    incidents,
    dailyPnlUsd: summary.dailyPnl,
    persistSideEffects: true,
  });

  const openExposureUsd = openPositions.reduce(
    (sum, p) => sum + Math.abs(p.notionalUsd),
    0,
  );
  const incidentOpenCount = incidents.filter(
    (i) => i.status === "OPEN" || i.status === "INVESTIGATING",
  ).length;
  const missionControllerRiskBudget = buildMissionControllerRiskBudget({
    integratedRiskBudget,
    currentEquity: GOAL_START_CAPITAL + summary.netPnl,
    winRate: summary.winRate,
    losingStreak: computeLosingStreakFromClosedTrades(closedTrades),
    maxDrawdownUsd: summary.maxDrawdown,
    dailyPnlUsd: summary.dailyPnl,
    openExposureUsd,
    openPositionCount: openPositions.length,
    incidentOpenCount,
    criticalIncidentOpen: Boolean(criticalIncident),
    blocksNewTestnetEntries: integratedStrategyHealth.blocksNewTestnetEntries,
  });

  const alwaysOnOperatorLayer = await buildAlwaysOnOperatorLayerSnapshot();

  const microLiveReadinessReview = buildMicroLiveReadinessReviewFromSnapshots({
    connected,
    testnetConfigured: config.testnetEnabled,
    evidenceProgress,
    evidenceQuality,
    integratedStrategyHealth,
    integratedRiskBudget,
    monitorReliability,
    engineConsistency,
    microLiveReadiness,
    alwaysOnOperatorLayer,
    criticalIncidentOpen: Boolean(criticalIncident),
    criticalIncidentTitle: criticalIncident?.title ?? null,
    learningPendingCount: learningQueue.filter(
      (q) => q.status === "PENDING_REVIEW",
    ).length,
  });
  await persistReadinessReviewSideEffects({ review: microLiveReadinessReview });

  return {
    openPositions,
    openOrders,
    closedTrades,
    summary,
    dailyPnlSeries: calculateDailyPnl(closedTrades),
    pnlBySymbol: groupPnlBySymbol(closedTrades),
    pnlByStrategy: groupPnlByStrategy(closedTrades),
    equitySeries,
    learningRecords,
    learningQueue,
    agentScoreboardSegment,
    strategyPerformanceSegment,
    validationMetricsSegment,
    executionQuality,
    evidenceProgress,
    monitorReliability,
    learningProgress,
    integratedStrategyHealth,
    microLiveReadiness,
    integratedTradeQuality,
    integratedConfidenceCalibration,
    agentScoreboardV2Segment: integratedConfidenceCalibration.agentScoreboardV2,
    integratedRiskBudget,
    integratedDailySelfReview,
    evidenceQuality,
    integratedQualityCalibration,
    integratedStrategyAgentHealth,
    missionControllerRiskBudget,
    engineConsistency,
    alwaysOnOperatorLayer,
    microLiveReadinessReview,
    lastUpdatedAt: new Date().toISOString(),
    connected,
    mismatches,
  };
}

export interface BuildTestnetMonitorSnapshotOptions {
  fresh?: boolean;
}

/** Cached entry point — dedupes parallel builds within TTL. */
export async function buildTestnetMonitorSnapshot(
  options: BuildTestnetMonitorSnapshotOptions = {},
): Promise<TestnetMonitorSnapshot> {
  return withTestnetMonitorSnapshotDedup(
    () => buildTestnetMonitorSnapshotUncached(),
    options,
  );
}

export function buildPnlReport(snapshot: TestnetMonitorSnapshot) {
  return {
    summary: snapshot.summary,
    dailyPnlSeries: snapshot.dailyPnlSeries,
    pnlBySymbol: snapshot.pnlBySymbol,
    pnlByStrategy: snapshot.pnlByStrategy,
    equitySeries: snapshot.equitySeries,
    lastUpdatedAt: snapshot.lastUpdatedAt,
  };
}
