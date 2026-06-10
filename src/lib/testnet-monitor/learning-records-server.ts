import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import { isClosedJournalEntry } from "@/lib/learning-queue/build-learning-progress";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import { classifyTradeResult } from "@/lib/testnet-monitor/pnl";
import type {
  TestnetAgentScoreboardSegment,
  TestnetClosedTrade,
  TestnetLearningQueueItem,
  TestnetLearningRecord,
  TestnetStrategyPerformanceSegment,
  TestnetValidationMetricsSegment,
} from "./types";

const LEARNING_RECORDS_FILE = "testnet-learning-records.json";

async function writeRecords(records: TestnetLearningRecord[]): Promise<void> {
  await writeCronJsonFile(LEARNING_RECORDS_FILE, records);
}

function parseCloseReason(note: string | null | undefined): string | null {
  const trimmed = note?.trim();
  if (!trimmed) return null;
  const monitor = trimmed.match(/Autonomous testnet monitor — (.+)/i);
  if (monitor?.[1]) return monitor[1];
  return trimmed;
}

function normalizeLearningRecord(
  raw: TestnetLearningRecord,
): TestnetLearningRecord {
  const tradeId = raw.tradeId ?? raw.closedTradeId;
  return {
    ...raw,
    tradeId,
    closedTradeId: raw.closedTradeId ?? tradeId,
    side: raw.side ?? null,
    strategyTag: raw.strategyTag ?? raw.strategy,
    aiVerdict: raw.aiVerdict ?? raw.finalVerdict,
    entryReason: raw.entryReason ?? null,
    closeReason: raw.closeReason ?? null,
    whatWorked: raw.whatWorked ?? null,
    whatFailed: raw.whatFailed ?? null,
    suggestedAdjustment: raw.suggestedAdjustment ?? null,
    qualityGrade: raw.qualityGrade ?? null,
    qualityScore: raw.qualityScore ?? null,
    qualityScoreId: raw.qualityScoreId ?? null,
  };
}

export async function saveLearningRecordsServer(
  records: TestnetLearningRecord[],
): Promise<void> {
  const next = records
    .map(normalizeLearningRecord)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  await writeRecords(next);
}

export async function loadLearningRecordsServer(): Promise<TestnetLearningRecord[]> {
  const parsed = await readCronJsonFile(LEARNING_RECORDS_FILE, [] as TestnetLearningRecord[]);
  if (!Array.isArray(parsed)) return [];
  return parsed.map(normalizeLearningRecord);
}

function newLearningRecordId(): string {
  return `tn-lrn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function confidenceFromDecision(entry: DecisionLogEntry | undefined): number | null {
  if (!entry) return null;
  if (entry.playbookConfidence != null && Number.isFinite(entry.playbookConfidence)) {
    return Number(entry.playbookConfidence.toFixed(3));
  }
  const committee = entry.agentOutputs.find((a) =>
    a.agentName.toLowerCase().includes("committee"),
  );
  if (!committee) return null;
  if (committee.confidence === "HIGH") return 0.8;
  if (committee.confidence === "MEDIUM") return 0.6;
  if (committee.confidence === "LOW") return 0.4;
  return null;
}

function estimateRMultiple(input: {
  netPnl: number;
  notionalUsd: number | null;
  existingR: number | null;
}): number {
  if (input.existingR != null && Number.isFinite(input.existingR)) {
    return Number(input.existingR.toFixed(3));
  }
  const riskUnit = Math.max(1, Math.abs(input.notionalUsd ?? 0) * 0.01);
  return Number((input.netPnl / riskUnit).toFixed(3));
}

function deriveExcursions(grossPnl: number): {
  mfe: number;
  mae: number;
} {
  return {
    mfe: Number(Math.max(grossPnl, 0).toFixed(4)),
    mae: Number(Math.min(grossPnl, 0).toFixed(4)),
  };
}

function entryReasonFrom(input: {
  journal?: BinanceTestnetJournalEntry;
  decision?: DecisionLogEntry;
}): string | null {
  const journalReason = input.journal?.reason?.trim();
  if (journalReason) return journalReason;
  const top = input.decision?.topReasons?.[0]?.trim();
  if (top) return top;
  return input.decision?.actionPlan?.trim() ?? null;
}

function buildLearningRecord(input: {
  trade?: TestnetClosedTrade;
  journal?: BinanceTestnetJournalEntry;
  decision?: DecisionLogEntry;
}): TestnetLearningRecord {
  const journal = input.journal;
  const trade = input.trade;
  const tradeId =
    journal?.binanceTestnetTradeId ?? trade?.id ?? newLearningRecordId();
  const now = new Date().toISOString();
  const notional = journal?.notionalUsd ?? null;
  const fee = journal?.fees ?? trade?.fee ?? 0;
  const netPnl = journal?.realizedPnl ?? trade?.netPnl ?? 0;
  const grossPnl = netPnl + fee;
  const side =
    journal?.side === "BUY" || trade?.side === "LONG"
      ? "LONG"
      : journal?.side === "SELL" || trade?.side === "SHORT"
        ? "SHORT"
        : null;
  const openedAt = journal?.executedAt ?? journal?.createdAt ?? trade?.openedAt ?? now;
  const closedAt = journal?.closedAt ?? trade?.closedAt ?? now;
  const durationMs =
    trade?.durationMs ??
    Math.max(0, Date.parse(closedAt) - Date.parse(openedAt));
  const result = trade?.result ?? classifyTradeResult(netPnl);
  const rMultiple = estimateRMultiple({
    netPnl,
    notionalUsd: notional,
    existingR: trade?.rMultiple ?? null,
  });
  const excursions = deriveExcursions(grossPnl);
  const aiVerdict = input.decision?.finalVerdict ?? trade?.aiVerdict ?? null;
  const strategyTag = journal?.source ?? trade?.strategy ?? null;

  return {
    learningRecordId: newLearningRecordId(),
    environment: "TESTNET",
    tradeId,
    symbol: journal?.symbol ?? trade?.symbol ?? "UNKNOWN",
    side,
    decisionLogId: journal?.decisionLogId ?? trade?.decisionLogId ?? null,
    previewId: journal?.previewId ?? trade?.previewId ?? null,
    orderId: journal?.exchangeOrderId ?? null,
    positionId: side ? `pos-${journal?.symbol ?? trade?.symbol}-${side}` : null,
    closedTradeId: tradeId,
    strategy: strategyTag,
    strategyTag,
    sourceAgent: journal?.source?.toUpperCase() ?? null,
    finalVerdict: aiVerdict,
    aiVerdict,
    confidence: confidenceFromDecision(input.decision) ?? trade?.confidence ?? null,
    entryReason: entryReasonFrom({ journal, decision: input.decision }),
    closeReason: parseCloseReason(journal?.operatorNote ?? trade?.notes),
    whatWorked: null,
    whatFailed: null,
    suggestedAdjustment: null,
    grossPnl: Number(grossPnl.toFixed(4)),
    netPnl: Number(netPnl.toFixed(4)),
    fee: Number(fee.toFixed(4)),
    rMultiple,
    maxFavorableExcursion: excursions.mfe,
    maxAdverseExcursion: excursions.mae,
    durationMs,
    result,
    includeInLearning: true,
    status: "PENDING_REVIEW",
    reflectionNotes: null,
    createdAt: closedAt,
    updatedAt: now,
  };
}

function patchMissingFields(
  existing: TestnetLearningRecord,
  fresh: TestnetLearningRecord,
): TestnetLearningRecord {
  return {
    ...existing,
    tradeId: existing.tradeId ?? fresh.tradeId,
    side: existing.side ?? fresh.side,
    strategyTag: existing.strategyTag ?? fresh.strategyTag,
    aiVerdict: existing.aiVerdict ?? fresh.aiVerdict,
    entryReason: existing.entryReason ?? fresh.entryReason,
    closeReason: existing.closeReason ?? fresh.closeReason,
    finalVerdict: existing.finalVerdict ?? fresh.finalVerdict,
    confidence: existing.confidence ?? fresh.confidence,
    updatedAt: new Date().toISOString(),
  };
}

/** MVP 73C — create a learning record for every CLOSED journal entry if missing. */
export async function syncLearningRecordsFromClosedTradesServer(input: {
  closedTrades: TestnetClosedTrade[];
  journal: BinanceTestnetJournalEntry[];
  decisions: DecisionLogEntry[];
}): Promise<TestnetLearningRecord[]> {
  const existing = await loadLearningRecordsServer();
  const byTradeId = new Map(
    existing.map((r) => [r.tradeId ?? r.closedTradeId, r]),
  );
  const journalByTradeId = new Map(
    input.journal.map((j) => [j.binanceTestnetTradeId, j]),
  );
  const tradeById = new Map(input.closedTrades.map((t) => [t.id, t]));
  const decisionsById = new Map(input.decisions.map((d) => [d.id, d]));

  for (const entry of input.journal) {
    if (!isClosedJournalEntry(entry)) continue;
    const tradeId = entry.binanceTestnetTradeId;
    const trade = tradeById.get(tradeId);
    const decision = entry.decisionLogId
      ? decisionsById.get(entry.decisionLogId)
      : trade?.decisionLogId
        ? decisionsById.get(trade.decisionLogId)
        : undefined;

    const current = byTradeId.get(tradeId);
    if (!current) {
      byTradeId.set(
        tradeId,
        buildLearningRecord({ trade, journal: entry, decision }),
      );
      continue;
    }

    const fresh = buildLearningRecord({ trade, journal: entry, decision });
    byTradeId.set(tradeId, patchMissingFields(current, fresh));
  }

  for (const trade of input.closedTrades) {
    if (byTradeId.has(trade.id)) continue;
    const journal = journalByTradeId.get(trade.id);
    const decision = trade.decisionLogId
      ? decisionsById.get(trade.decisionLogId)
      : undefined;
    byTradeId.set(
      trade.id,
      buildLearningRecord({ trade, journal, decision }),
    );
  }

  const next = [...byTradeId.values()]
    .map(normalizeLearningRecord)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  await writeRecords(next);
  return next;
}

function mapRecordToQueueItem(record: TestnetLearningRecord): TestnetLearningQueueItem {
  return {
    learningRecordId: record.learningRecordId,
    closedTradeId: record.closedTradeId,
    symbol: record.symbol,
    decisionLogId: record.decisionLogId,
    netPnl: record.netPnl,
    result: record.result,
    closedAt: record.createdAt,
    status: record.status,
    reflectionNotes: record.reflectionNotes,
  };
}

export function buildLearningQueueFromRecords(
  records: TestnetLearningRecord[],
): TestnetLearningQueueItem[] {
  return records
    .filter((r) => r.status !== "LEARNED" && r.status !== "EXCLUDED")
    .map(mapRecordToQueueItem)
    .sort((a, b) => b.closedAt.localeCompare(a.closedAt));
}

type LearningRecordPatch = Partial<
  Pick<
    TestnetLearningRecord,
    | "status"
    | "reflectionNotes"
    | "includeInLearning"
    | "whatWorked"
    | "whatFailed"
    | "suggestedAdjustment"
  >
>;

async function patchRecord(
  learningRecordId: string,
  patch: LearningRecordPatch,
): Promise<TestnetLearningRecord | null> {
  const existing = await loadLearningRecordsServer();
  let updated: TestnetLearningRecord | null = null;
  const next = existing.map((record) => {
    if (record.learningRecordId !== learningRecordId) return record;
    updated = {
      ...record,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    return updated;
  });
  if (!updated) return null;
  await writeRecords(next);
  return updated;
}

export async function markLearningRecordLearnedServer(
  learningRecordId: string,
  review?: {
    whatWorked?: string | null;
    whatFailed?: string | null;
    suggestedAdjustment?: string | null;
  },
): Promise<TestnetLearningRecord | null> {
  const patch: LearningRecordPatch = {
    status: "LEARNED",
    includeInLearning: true,
  };
  if (review?.whatWorked != null) patch.whatWorked = review.whatWorked;
  if (review?.whatFailed != null) patch.whatFailed = review.whatFailed;
  if (review?.suggestedAdjustment != null) {
    patch.suggestedAdjustment = review.suggestedAdjustment;
  }
  return patchRecord(learningRecordId, patch);
}

/** Autopilot path — ingest closed trades without operator clicking Mark learned. */
export async function autoMarkPendingLearningRecordsServer(): Promise<{
  marked: number;
  ids: string[];
}> {
  const records = await loadLearningRecordsServer();
  const pending = records.filter((r) => r.status === "PENDING_REVIEW");
  if (pending.length === 0) return { marked: 0, ids: [] };

  const ids: string[] = [];
  const next = records.map((record) => {
    if (record.status !== "PENDING_REVIEW") return record;
    ids.push(record.learningRecordId);
    return {
      ...record,
      status: "LEARNED" as const,
      includeInLearning: true,
      updatedAt: new Date().toISOString(),
    };
  });
  await writeRecords(next);
  return { marked: ids.length, ids };
}

export async function excludeLearningRecordServer(
  learningRecordId: string,
): Promise<TestnetLearningRecord | null> {
  return patchRecord(learningRecordId, {
    status: "EXCLUDED",
    includeInLearning: false,
  });
}

export async function markLearningRecordPendingReviewServer(
  learningRecordId: string,
): Promise<TestnetLearningRecord | null> {
  return patchRecord(learningRecordId, {
    status: "PENDING_REVIEW",
    includeInLearning: true,
  });
}

export async function generateLearningReflectionServer(input: {
  learningRecordId: string;
  notes?: string | null;
}): Promise<TestnetLearningRecord | null> {
  const existing = await loadLearningRecordsServer();
  const target = existing.find((r) => r.learningRecordId === input.learningRecordId);
  if (!target) return null;
  const notes =
    input.notes?.trim() ||
    `TESTNET ${target.result} ${target.symbol} net ${target.netPnl.toFixed(2)} R ${target.rMultiple.toFixed(2)}`;
  const whatFailed =
    target.result === "LOSS"
      ? target.closeReason ?? "Loss — review entry thesis and exit timing."
      : null;
  const whatWorked =
    target.result === "WIN"
      ? target.entryReason ?? "Win — entry aligned with thesis."
      : null;
  return patchRecord(input.learningRecordId, {
    status: "REFLECTION_READY",
    reflectionNotes: notes,
    whatWorked: target.whatWorked ?? whatWorked,
    whatFailed: target.whatFailed ?? whatFailed,
  });
}

function learnedRecords(records: TestnetLearningRecord[]): TestnetLearningRecord[] {
  return records.filter((r) => r.status === "LEARNED" && r.includeInLearning);
}

export function buildAgentScoreboardSegmentFromRecords(
  records: TestnetLearningRecord[],
): TestnetAgentScoreboardSegment {
  const learned = learnedRecords(records);
  const byAgent = new Map<
    string,
    { n: number; wins: number; net: number; quality: number[]; scoredWins: number; scoredTotal: number }
  >();
  for (const record of learned) {
    const key = record.sourceAgent ?? "UNKNOWN";
    const row = byAgent.get(key) ?? {
      n: 0,
      wins: 0,
      net: 0,
      quality: [],
      scoredWins: 0,
      scoredTotal: 0,
    };
    row.n += 1;
    if (record.result === "WIN") row.wins += 1;
    row.net += record.netPnl;
    byAgent.set(key, row);
  }
  for (const record of records) {
    if (record.qualityScore == null) continue;
    const key = record.sourceAgent ?? "UNKNOWN";
    const row = byAgent.get(key) ?? {
      n: 0,
      wins: 0,
      net: 0,
      quality: [],
      scoredWins: 0,
      scoredTotal: 0,
    };
    row.quality.push(record.qualityScore);
    row.scoredTotal += 1;
    if (record.result === "WIN") row.scoredWins += 1;
    byAgent.set(key, row);
  }
  return {
    environment: "TESTNET",
    totalLearned: learned.length,
    rows: [...byAgent.entries()]
      .map(([sourceAgent, row]) => ({
        sourceAgent,
        totalLearned: row.n,
        winningTrades: row.wins,
        winRate: row.n > 0 ? (row.wins / row.n) * 100 : 0,
        netPnl: Number(row.net.toFixed(4)),
        avgQualityScore:
          row.quality.length > 0
            ? Math.round(
                row.quality.reduce((a, b) => a + b, 0) / row.quality.length,
              )
            : null,
        agentAlignmentPct:
          row.scoredTotal > 0
            ? Math.round((row.scoredWins / row.scoredTotal) * 100)
            : null,
      }))
      .sort((a, b) => b.totalLearned - a.totalLearned),
    updatedAt: new Date().toISOString(),
  };
}

export function buildStrategyPerformanceSegmentFromRecords(
  records: TestnetLearningRecord[],
): TestnetStrategyPerformanceSegment {
  const learned = learnedRecords(records);
  const byStrategy = new Map<string, { n: number; wins: number; net: number; r: number }>();
  for (const record of learned) {
    const key = record.strategyTag ?? record.strategy ?? "UNSPECIFIED";
    const row = byStrategy.get(key) ?? { n: 0, wins: 0, net: 0, r: 0 };
    row.n += 1;
    if (record.result === "WIN") row.wins += 1;
    row.net += record.netPnl;
    row.r += record.rMultiple;
    byStrategy.set(key, row);
  }
  return {
    environment: "TESTNET",
    totalLearned: learned.length,
    rows: [...byStrategy.entries()]
      .map(([strategy, row]) => ({
        strategy,
        totalLearned: row.n,
        winRate: row.n > 0 ? (row.wins / row.n) * 100 : 0,
        netPnl: Number(row.net.toFixed(4)),
        averageR: row.n > 0 ? Number((row.r / row.n).toFixed(4)) : 0,
      }))
      .sort((a, b) => b.totalLearned - a.totalLearned),
    updatedAt: new Date().toISOString(),
  };
}

export function buildValidationMetricsSegmentFromRecords(
  records: TestnetLearningRecord[],
): TestnetValidationMetricsSegment {
  const learned = learnedRecords(records);
  const net = learned.reduce((sum, r) => sum + r.netPnl, 0);
  const avgR =
    learned.length > 0
      ? learned.reduce((sum, r) => sum + r.rMultiple, 0) / learned.length
      : 0;
  const winRate =
    learned.length > 0
      ? (learned.filter((r) => r.result === "WIN").length / learned.length) * 100
      : 0;
  return {
    environment: "TESTNET",
    totalClosedTrades: records.length,
    includedInLearning: records.filter((r) => r.includeInLearning).length,
    excludedFromLearning: records.filter((r) => r.status === "EXCLUDED").length,
    learnedCount: learned.length,
    winRate: Number(winRate.toFixed(4)),
    netPnl: Number(net.toFixed(4)),
    averageR: Number(avgR.toFixed(4)),
    updatedAt: new Date().toISOString(),
  };
}
