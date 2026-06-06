import fs from "fs/promises";
import path from "path";
import { getCronDataDir } from "@/lib/cron/cron-config";
import type {
  BinanceExecuteResult,
  BinanceOrderPreview,
  BinanceTestnetJournalEntry,
} from "./binance-types";

const SERVER_JOURNAL_FILE = "binance-testnet-journal.json";
const MAX_ENTRIES = 200;

function serverJournalPath(): string {
  return path.join(getCronDataDir(), SERVER_JOURNAL_FILE);
}

export async function loadServerBinanceTestnetJournal(): Promise<
  BinanceTestnetJournalEntry[]
> {
  try {
    const raw = await fs.readFile(serverJournalPath(), "utf8");
    const parsed = JSON.parse(raw) as BinanceTestnetJournalEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function appendServerBinanceTestnetJournal(
  entry: BinanceTestnetJournalEntry,
): Promise<BinanceTestnetJournalEntry[]> {
  const filePath = serverJournalPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const next = [entry, ...(await loadServerBinanceTestnetJournal())].slice(
    0,
    MAX_ENTRIES,
  );
  await fs.writeFile(filePath, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function recordTestnetTradeJournal(
  entry: BinanceTestnetJournalEntry,
): Promise<BinanceTestnetJournalEntry> {
  await appendServerBinanceTestnetJournal(entry);
  return entry;
}

export function buildJournalEntryFromPreview(
  preview: BinanceOrderPreview,
  patch?: Partial<BinanceTestnetJournalEntry>,
): BinanceTestnetJournalEntry {
  return {
    binanceTestnetTradeId: newBinanceTestnetTradeId(),
    previewId: preview.previewId,
    symbol: preview.symbol,
    side: preview.side,
    notionalUsd: preview.notionalUsd,
    quantity: preview.estimatedQty,
    status: preview.blocked ? "BLOCKED" : "PREVIEWED",
    source: preview.source,
    reason: preview.reason,
    decisionLogId: preview.decisionLogId,
    exchangeOrderId: null,
    clientOrderId: null,
    operatorNote: null,
    blockReasons: preview.blockReasons,
    createdAt: new Date().toISOString(),
    executedAt: null,
    closedAt: null,
    realizedPnl: null,
    fees: null,
    previewPrice: preview.markPrice ?? null,
    markPriceAtSubmit: preview.markPrice ?? null,
    fillPrice: null,
    slippage: null,
    slippageBps: null,
    latencyMs: null,
    partialFill: false,
    duplicateSubmission: false,
    retryCount: 0,
    closeAttempt: false,
    closeFailed: false,
    ...patch,
  };
}

export function buildBlockedExecuteResult(
  preview: BinanceOrderPreview,
  blockReasons: string[],
): BinanceExecuteResult {
  const journalEntry = buildJournalEntryFromPreview(preview, {
    status: "BLOCKED",
    blockReasons,
  });
  return {
    ok: false,
    blocked: true,
    exchangeOrderId: null,
    journalEntry,
    error: blockReasons[0] ?? "Blocked",
  };
}

export function newBinanceTestnetTradeId(): string {
  return `bn-tn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
