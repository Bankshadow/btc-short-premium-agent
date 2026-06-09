import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import type {
  BinanceExecuteResult,
  BinanceOrderPreview,
  BinanceTestnetJournalEntry,
} from "./binance-types";

const SERVER_JOURNAL_FILE = "binance-testnet-journal.json";
const MAX_ENTRIES = 200;

export async function loadServerBinanceTestnetJournal(): Promise<
  BinanceTestnetJournalEntry[]
> {
  const parsed = await readCronJsonFile(SERVER_JOURNAL_FILE, [] as BinanceTestnetJournalEntry[]);
  return Array.isArray(parsed) ? parsed : [];
}

export async function appendServerBinanceTestnetJournal(
  entry: BinanceTestnetJournalEntry,
): Promise<BinanceTestnetJournalEntry[]> {
  const next = [entry, ...(await loadServerBinanceTestnetJournal())].slice(
    0,
    MAX_ENTRIES,
  );
  await writeCronJsonFile(SERVER_JOURNAL_FILE, next);
  return next;
}

export async function saveServerBinanceTestnetJournal(
  entries: BinanceTestnetJournalEntry[],
): Promise<void> {
  await writeCronJsonFile(SERVER_JOURNAL_FILE, entries.slice(0, MAX_ENTRIES));
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
