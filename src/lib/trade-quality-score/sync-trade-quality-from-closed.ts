import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { isClosedJournalEntry } from "@/lib/learning-queue/build-learning-progress";
import type { TestnetClosedTrade, TestnetLearningRecord } from "@/lib/testnet-monitor/types";
import { recordMonitorEvent } from "@/lib/testnet-monitor/monitor-journal-server";
import { buildTradeQualitySummary } from "./build-summary";
import { buildTestnetClosedTradeQualityScore } from "./score-testnet-closed-trade";
import {
  loadTradeQualityStore,
  upsertTradeQualityScore,
} from "./quality-store";
import type {
  IntegratedTradeQualitySnapshot,
  TradeQualityScore,
} from "./types";
import { TRADE_QUALITY_MVP } from "./types";

const INTEGRATED_LABEL = "Integrated Trade Quality Score";

function attachQualityToLearningRecord(
  record: TestnetLearningRecord,
  score: TradeQualityScore,
): TestnetLearningRecord {
  return {
    ...record,
    qualityGrade: score.grade,
    qualityScore: score.compositeScore,
    qualityScoreId: score.scoreId,
    updatedAt: new Date().toISOString(),
  };
}

export async function syncTradeQualityFromClosedJournal(input: {
  journal: BinanceTestnetJournalEntry[];
  closedTrades: TestnetClosedTrade[];
  decisions: DecisionLogEntry[];
  learningRecords: TestnetLearningRecord[];
  persistEvents?: boolean;
}): Promise<{
  scores: TradeQualityScore[];
  learningRecords: TestnetLearningRecord[];
  newlyScored: number;
}> {
  const tradeById = new Map(input.closedTrades.map((t) => [t.id, t]));
  const decisionsById = new Map(input.decisions.map((d) => [d.id, d]));
  const existingStore = await loadTradeQualityStore();
  const scoredByTrade = new Map(
    existingStore.scores
      .filter((s) => s.tradeId)
      .map((s) => [s.tradeId as string, s]),
  );

  let newlyScored = 0;
  const scores: TradeQualityScore[] = [...existingStore.scores];

  for (const entry of input.journal) {
    if (!isClosedJournalEntry(entry)) continue;
    const tradeId = entry.binanceTestnetTradeId;
    if (scoredByTrade.has(tradeId)) continue;

    const score = buildTestnetClosedTradeQualityScore({
      journal: entry,
      closedTrade: tradeById.get(tradeId),
      decision: entry.decisionLogId
        ? decisionsById.get(entry.decisionLogId)
        : undefined,
    });

    await upsertTradeQualityScore(score);
    scoredByTrade.set(tradeId, score);
    scores.unshift(score);
    newlyScored += 1;

    if (input.persistEvents) {
      await recordMonitorEvent({
        exchange: "BINANCE",
        environment: "TESTNET",
        eventType: "TRADE_QUALITY_SCORED",
        symbol: entry.symbol,
        decisionLogId: entry.decisionLogId,
        orderId: entry.exchangeOrderId,
        positionId: null,
        payload: {
          tradeId,
          grade: score.grade,
          numericScore: score.compositeScore,
          dataConfidence: score.dataConfidence ?? 1,
          improvementSuggestion: score.improvementSuggestion,
        },
      });
    }
  }

  const learningRecords = input.learningRecords.map((record) => {
    const tradeId = record.tradeId ?? record.closedTradeId;
    const score = scoredByTrade.get(tradeId);
    if (!score) return record;
    if (record.qualityScoreId === score.scoreId) return record;
    return attachQualityToLearningRecord(record, score);
  });

  const uniqueScores = [
    ...new Map(
      scores.map((s) => [s.tradeId ?? s.decisionLogId, s]),
    ).values(),
  ];

  return { scores: uniqueScores, learningRecords, newlyScored };
}

export function buildIntegratedTradeQualitySnapshot(input: {
  scores: TradeQualityScore[];
}): IntegratedTradeQualitySnapshot {
  const testnetScores = input.scores.filter((s) => s.source === "testnet_closed");
  const summary = buildTradeQualitySummary(input.scores);
  summary.testnetScoredCount = testnetScores.length;

  const agentScores = testnetScores.filter(
    (s) => (s.dataConfidence ?? 1) >= 0.5,
  );
  summary.avgAgentAlignment =
    agentScores.length > 0
      ? Math.round(
          agentScores.reduce(
            (sum, s) => sum + (s.reasoningConsistency ?? s.dimensions.reasoningConsistency),
            0,
          ) / agentScores.length,
        )
      : null;

  const scoresByTradeId: Record<string, TradeQualityScore> = {};
  for (const s of input.scores) {
    if (s.tradeId) scoresByTradeId[s.tradeId] = s;
  }

  return {
    mvp: TRADE_QUALITY_MVP,
    label: INTEGRATED_LABEL,
    summary,
    scoresByTradeId,
    autoStrategyChangeAllowed: false,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function enrichAgentScoreboardWithQuality(input: {
  rows: import("@/lib/testnet-monitor/types").TestnetAgentScoreRow[];
  learningRecords: TestnetLearningRecord[];
}): Array<
  import("@/lib/testnet-monitor/types").TestnetAgentScoreRow & {
    avgQualityScore: number | null;
    agentAlignmentPct: number | null;
  }
> {
  const byAgent = new Map<
    string,
    { quality: number[]; wins: number; total: number }
  >();

  for (const record of input.learningRecords) {
    if (record.qualityScore == null) continue;
    const key = record.sourceAgent ?? "UNKNOWN";
    const row = byAgent.get(key) ?? { quality: [], wins: 0, total: 0 };
    row.quality.push(record.qualityScore);
    row.total += 1;
    if (record.result === "WIN") row.wins += 1;
    byAgent.set(key, row);
  }

  return input.rows.map((row) => {
    const stats = byAgent.get(row.sourceAgent);
    if (!stats || stats.quality.length === 0) {
      return { ...row, avgQualityScore: null, agentAlignmentPct: null };
    }
    return {
      ...row,
      avgQualityScore: Math.round(
        stats.quality.reduce((a, b) => a + b, 0) / stats.quality.length,
      ),
      agentAlignmentPct:
        stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : null,
    };
  });
}
