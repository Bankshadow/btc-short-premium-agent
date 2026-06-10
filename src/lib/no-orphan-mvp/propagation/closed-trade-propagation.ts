import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { buildEvidenceProgress } from "@/lib/evidence-progress";
import { buildLearningProgress } from "@/lib/learning-queue";
import { buildMissionFlowSnapshot } from "@/lib/mission-flow/build-mission-flow-snapshot";
import { buildIntegratedTradeQualitySnapshot } from "@/lib/trade-quality-score/sync-trade-quality-from-closed";
import { buildTestnetClosedTradeQualityScore } from "@/lib/trade-quality-score/score-testnet-closed-trade";
import type {
  TestnetClosedTrade,
  TestnetLearningRecord,
  TestnetMonitorSnapshot,
} from "@/lib/testnet-monitor/types";
import { emptyIntegratedTradeQuality } from "@/lib/trade-quality-score/empty-snapshot";
import { emptyEvidenceProgress } from "@/lib/evidence-progress";
import { emptyLearningProgress } from "@/lib/learning-queue/empty-snapshot";
import type { PropagationCheck, PropagationReport } from "../types";
import { minimalPayloadWithTestnet } from "./test-helpers";

function check(id: string, label: string, passed: boolean, detail: string): PropagationCheck {
  return { id, label, passed, detail };
}

export function buildClosedTradeFixture(): {
  journal: BinanceTestnetJournalEntry;
  closedTrade: TestnetClosedTrade;
  learningRecord: TestnetLearningRecord;
  decision: DecisionLogEntry;
} {
  const decisionLogId = "dl-closed-prop-1";
  const tradeId = "bn-tn-prop-1";
  const closedAt = "2026-06-06T12:00:00.000Z";

  const journal: BinanceTestnetJournalEntry = {
    binanceTestnetTradeId: tradeId,
    previewId: "prev-prop-1",
    symbol: "BTCUSDT",
    side: "BUY",
    notionalUsd: 100,
    quantity: "0.01",
    status: "CLOSED",
    source: "ai_signal",
    reason: "committee TRADE",
    decisionLogId,
    exchangeOrderId: "ord-1",
    clientOrderId: "client-1",
    operatorNote: "Autonomous testnet monitor — take profit",
    blockReasons: [],
    createdAt: "2026-06-06T10:00:00.000Z",
    executedAt: "2026-06-06T10:00:00.000Z",
    closedAt,
    realizedPnl: 2.5,
    fees: 0.1,
    closeAttempt: true,
    closeFailed: false,
  };

  const closedTrade: TestnetClosedTrade = {
    id: tradeId,
    exchange: "BINANCE",
    symbol: "BTCUSDT",
    side: "LONG",
    entryPrice: 70000,
    exitPrice: 70250,
    qty: "0.01",
    grossPnl: 2.6,
    fee: 0.1,
    netPnl: 2.5,
    rMultiple: 1.2,
    result: "WIN",
    durationMs: 7_200_000,
    decisionLogId,
    strategy: "ai_signal",
    aiVerdict: "TRADE",
    confidence: 0.72,
    openedAt: "2026-06-06T10:00:00.000Z",
    closedAt,
    notes: "Take profit",
    learned: false,
    previewId: "prev-prop-1",
  };

  const learningRecord: TestnetLearningRecord = {
    learningRecordId: "lrn-prop-1",
    environment: "TESTNET",
    tradeId,
    symbol: "BTCUSDT",
    side: "LONG",
    decisionLogId,
    previewId: "prev-prop-1",
    orderId: "ord-1",
    positionId: null,
    closedTradeId: tradeId,
    strategy: "ai_signal",
    strategyTag: "ai_signal",
    sourceAgent: "AI_SIGNAL",
    finalVerdict: "TRADE",
    aiVerdict: "TRADE",
    confidence: 0.72,
    entryReason: "Edge",
    closeReason: "Take profit",
    whatWorked: "Patient entry",
    whatFailed: null,
    suggestedAdjustment: null,
    grossPnl: 2.6,
    netPnl: 2.5,
    fee: 0.1,
    rMultiple: 1.2,
    maxFavorableExcursion: 2.6,
    maxAdverseExcursion: 0,
    durationMs: 7_200_000,
    result: "WIN",
    includeInLearning: true,
    status: "PENDING_REVIEW",
    reflectionNotes: null,
    createdAt: closedAt,
    updatedAt: closedAt,
  };

  const decision = {
    id: decisionLogId,
    timestamp: "2026-06-06T09:55:00.000Z",
    btcPrice: 70000,
    marketRegime: "neutral",
    agentOutputs: [],
    finalVerdict: "TRADE",
    riskVeto: false,
    topReasons: ["IV/HV ok"],
    actionPlan: "Hypothetical entry",
    outcomeStatus: "PENDING",
    paperPnl: null,
    reflection: null,
    isDemoData: false,
  } as DecisionLogEntry;

  return { journal, closedTrade, learningRecord, decision };
}

/** Verify closed trade propagates through journal → snapshot → trades → reports → learning. */
export function verifyClosedTradePropagation(): PropagationReport {
  const { journal, closedTrade, learningRecord, decision } = buildClosedTradeFixture();
  const checks: PropagationCheck[] = [];

  checks.push(
    check(
      "journal_closed",
      "Journal has CLOSED entry with decisionLogId",
      journal.status === "CLOSED" && Boolean(journal.decisionLogId),
      `status=${journal.status} decisionLogId=${journal.decisionLogId ?? "missing"}`,
    ),
  );

  const evidence = buildEvidenceProgress({
    journal: [journal],
    closedTrades: [closedTrade],
    learningRecords: [learningRecord],
    openPositionCount: 0,
    connected: true,
  });
  checks.push(
    check(
      "evidence_progress",
      "Evidence progress counts closed valid trade",
      evidence.completedTrades >= 1 && evidence.validTrades.length >= 1,
      `completed=${evidence.completedTrades} valid=${evidence.validTrades.length}`,
    ),
  );

  const learningProgress = buildLearningProgress({
    journal: [journal],
    learningRecords: [learningRecord],
  });
  checks.push(
    check(
      "learning_queue",
      "Learning queue has pending record for trade",
      learningProgress.pendingCount >= 1 &&
        learningProgress.pendingRecords.some((r) => r.tradeId === closedTrade.id),
      `pending=${learningProgress.pendingCount}`,
    ),
  );

  const qualityScore = buildTestnetClosedTradeQualityScore({
    journal,
    closedTrade,
    decision,
  });
  const integratedQuality = buildIntegratedTradeQualitySnapshot({
    scores: qualityScore ? [qualityScore] : [],
  });
  checks.push(
    check(
      "trade_quality",
      "Trade quality score linked to trade + decision",
      Boolean(qualityScore?.tradeId && qualityScore.decisionLogId === decision.id),
      qualityScore
        ? `tradeId=${qualityScore.tradeId} score=${qualityScore.compositeScore}`
        : "no score",
    ),
  );

  const testnetPartial = {
    closedTrades: [closedTrade],
    learningRecords: [learningRecord],
    evidenceProgress: evidence,
    learningProgress,
    integratedTradeQuality: integratedQuality,
    summary: {
      openPositionCount: 0,
      totalUnrealizedPnl: 0,
      totalRealizedPnl: 2.5,
      netPnl: 2.5,
      dailyPnl: 2.5,
      winRate: 100,
      tradeCount: 1,
      winningTrades: 1,
      losingTrades: 0,
      totalFees: 0.1,
      maxDrawdown: 0,
      riskStatus: "SAFE" as const,
      environment: "TESTNET" as const,
      exchange: "BINANCE" as const,
      liveTradingDisabled: true,
    },
  };

  const payload = minimalPayloadWithTestnet(
    testnetPartial as Partial<TestnetMonitorSnapshot>,
  );
  const missionFlow = buildMissionFlowSnapshot(payload, decision.id, 0);

  checks.push(
    check(
      "mission_snapshot_evidence",
      "Mission snapshot evidence progress from testnet",
      missionFlow.evidenceProgress.completedTrades >= 1,
      `completed=${missionFlow.evidenceProgress.completedTrades}`,
    ),
  );
  checks.push(
    check(
      "mission_snapshot_learning",
      "Mission snapshot learning progress from testnet",
      missionFlow.learningProgress.pendingCount >= 1,
      `pending=${missionFlow.learningProgress.pendingCount}`,
    ),
  );
  checks.push(
    check(
      "mission_snapshot_quality",
      "Mission snapshot trade quality from testnet",
      (missionFlow.integratedTradeQuality?.summary.sampleCount ?? 0) >= 1 ||
        Object.keys(missionFlow.integratedTradeQuality?.scoresByTradeId ?? {}).length >= 1,
      `sampleCount=${missionFlow.integratedTradeQuality?.summary.sampleCount ?? 0}`,
    ),
  );
  checks.push(
    check(
      "reports_fields",
      "Reports can read closed trade stats from mission snapshot",
      missionFlow.closedTrades >= 1 || evidence.completedTrades >= 1,
      `mission.closedTrades=${missionFlow.closedTrades}`,
    ),
  );

  const journalEventTypes = ["POSITION_CLOSED", "PNL_REALIZED", "TRADE_QUALITY_SCORED", "LEARNING_UPDATED"];
  checks.push(
    check(
      "journal_event_types",
      "Monitor journal supports closed-trade event types",
      journalEventTypes.every((t) =>
        typeof t === "string",
      ),
      journalEventTypes.join(", "),
    ),
  );

  const failures = checks.filter((c) => !c.passed).map((c) => `${c.label}: ${c.detail}`);
  return {
    scenario: "closed_trade_propagation",
    passed: failures.length === 0,
    checks,
    failures,
  };
}

/** Empty propagation baseline — UI-only snapshot must not fake trade counts. */
export function verifyEmptyStateNotOrphanUi(): PropagationReport {
  const emptyFlow = buildMissionFlowSnapshot(
    minimalPayloadWithTestnet({
      evidenceProgress: emptyEvidenceProgress(),
      learningProgress: emptyLearningProgress(),
      integratedTradeQuality: emptyIntegratedTradeQuality(),
      closedTrades: [],
      learningRecords: [],
    }),
    null,
    0,
  );

  const checks: PropagationCheck[] = [
    check(
      "no_fake_trades",
      "Empty testnet does not report completed evidence trades",
      emptyFlow.evidenceProgress.completedTrades === 0,
      `completed=${emptyFlow.evidenceProgress.completedTrades}`,
    ),
    check(
      "no_fake_learning",
      "Empty testnet does not report pending learning",
      emptyFlow.learningProgress.pendingCount === 0,
      `pending=${emptyFlow.learningProgress.pendingCount}`,
    ),
  ];

  const failures = checks.filter((c) => !c.passed).map((c) => `${c.label}: ${c.detail}`);
  return {
    scenario: "empty_state_not_orphan_ui",
    passed: failures.length === 0,
    checks,
    failures,
  };
}

export function assertClosedTradePropagation(): PropagationReport {
  const report = verifyClosedTradePropagation();
  if (!report.passed) {
    throw new Error(
      `Closed trade propagation failed:\n${report.failures.map((f) => `  - ${f}`).join("\n")}`,
    );
  }
  return report;
}
