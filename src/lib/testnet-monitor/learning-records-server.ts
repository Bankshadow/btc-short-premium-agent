import fs from "fs/promises";
import path from "path";
import { getCronDataDir } from "@/lib/cron/cron-config";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import type {
  TestnetAgentScoreboardSegment,
  TestnetClosedTrade,
  TestnetLearningQueueItem,
  TestnetLearningRecord,
  TestnetStrategyPerformanceSegment,
  TestnetValidationMetricsSegment,
} from "./types";

const LEARNING_RECORDS_FILE = "testnet-learning-records.json";

function recordsPath(): string {
  return path.join(getCronDataDir(), LEARNING_RECORDS_FILE);
}

function newLearningRecordId(): string {
  return `tn-lrn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function confidenceFromDecision(entry: DecisionLogEntry | undefined): number | null {
  if (!entry) return null;
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

async function writeRecords(records: TestnetLearningRecord[]): Promise<void> {
  const filePath = recordsPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(records, null, 2), "utf8");
}

export async function loadLearningRecordsServer(): Promise<TestnetLearningRecord[]> {
  try {
    const raw = await fs.readFile(recordsPath(), "utf8");
    const parsed = JSON.parse(raw) as TestnetLearningRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function buildLearningRecord(input: {
  trade: TestnetClosedTrade;
  journal?: BinanceTestnetJournalEntry;
  decision?: DecisionLogEntry;
}): TestnetLearningRecord {
  const now = new Date().toISOString();
  const notional = input.journal?.notionalUsd ?? null;
  const rMultiple = estimateRMultiple({
    netPnl: input.trade.netPnl,
    notionalUsd: notional,
    existingR: input.trade.rMultiple,
  });
  const excursions = deriveExcursions(input.trade.grossPnl);
  return {
    learningRecordId: newLearningRecordId(),
    environment: "TESTNET",
    symbol: input.trade.symbol,
    decisionLogId: input.trade.decisionLogId,
    previewId: input.trade.previewId,
    orderId: input.journal?.exchangeOrderId ?? null,
    positionId: `pos-${input.trade.symbol}-${input.trade.side}`,
    closedTradeId: input.trade.id,
    strategy: input.trade.strategy,
    sourceAgent: input.journal?.source?.toUpperCase() ?? null,
    finalVerdict: input.decision?.finalVerdict ?? null,
    confidence: confidenceFromDecision(input.decision),
    grossPnl: Number(input.trade.grossPnl.toFixed(4)),
    netPnl: Number(input.trade.netPnl.toFixed(4)),
    fee: Number(input.trade.fee.toFixed(4)),
    rMultiple,
    maxFavorableExcursion: excursions.mfe,
    maxAdverseExcursion: excursions.mae,
    durationMs: input.trade.durationMs,
    result: input.trade.result,
    includeInLearning: true,
    status: "PENDING_REVIEW",
    reflectionNotes: null,
    createdAt: input.trade.closedAt,
    updatedAt: now,
  };
}

export async function syncLearningRecordsFromClosedTradesServer(input: {
  closedTrades: TestnetClosedTrade[];
  journal: BinanceTestnetJournalEntry[];
  decisions: DecisionLogEntry[];
}): Promise<TestnetLearningRecord[]> {
  const existing = await loadLearningRecordsServer();
  const byTradeId = new Map(existing.map((r) => [r.closedTradeId, r]));
  const journalByTradeId = new Map(
    input.journal.map((j) => [j.binanceTestnetTradeId, j]),
  );
  const decisionsById = new Map(input.decisions.map((d) => [d.id, d]));

  for (const trade of input.closedTrades) {
    if (byTradeId.has(trade.id)) continue;
    const record = buildLearningRecord({
      trade,
      journal: journalByTradeId.get(trade.id),
      decision: trade.decisionLogId
        ? decisionsById.get(trade.decisionLogId)
        : undefined,
    });
    byTradeId.set(trade.id, record);
  }

  const next = [...byTradeId.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
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
    .filter((r) => r.status !== "LEARNED")
    .map(mapRecordToQueueItem)
    .sort((a, b) => b.closedAt.localeCompare(a.closedAt));
}

async function patchRecordStatus(
  learningRecordId: string,
  patch: Partial<Pick<TestnetLearningRecord, "status" | "reflectionNotes" | "includeInLearning">>,
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
): Promise<TestnetLearningRecord | null> {
  return patchRecordStatus(learningRecordId, {
    status: "LEARNED",
    includeInLearning: true,
  });
}

export async function excludeLearningRecordServer(
  learningRecordId: string,
): Promise<TestnetLearningRecord | null> {
  return patchRecordStatus(learningRecordId, {
    status: "EXCLUDED",
    includeInLearning: false,
  });
}

export async function markLearningRecordPendingReviewServer(
  learningRecordId: string,
): Promise<TestnetLearningRecord | null> {
  return patchRecordStatus(learningRecordId, {
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
    `TESTNET ${target.result} ${target.positionId ?? ""} net ${target.netPnl.toFixed(2)} R ${target.rMultiple.toFixed(2)}`;
  return patchRecordStatus(input.learningRecordId, {
    status: "REFLECTION_READY",
    reflectionNotes: notes,
  });
}

function learnedRecords(records: TestnetLearningRecord[]): TestnetLearningRecord[] {
  return records.filter((r) => r.status === "LEARNED" && r.includeInLearning);
}

export function buildAgentScoreboardSegmentFromRecords(
  records: TestnetLearningRecord[],
): TestnetAgentScoreboardSegment {
  const learned = learnedRecords(records);
  const byAgent = new Map<string, { n: number; wins: number; net: number }>();
  for (const record of learned) {
    const key = record.sourceAgent ?? "UNKNOWN";
    const row = byAgent.get(key) ?? { n: 0, wins: 0, net: 0 };
    row.n += 1;
    if (record.result === "WIN") row.wins += 1;
    row.net += record.netPnl;
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
    const key = record.strategy ?? "UNSPECIFIED";
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
