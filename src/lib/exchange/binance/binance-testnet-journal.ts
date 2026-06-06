import type { BinanceTestnetJournalEntry } from "./binance-types";

export const BINANCE_TESTNET_JOURNAL_KEY = "btc-desk:binance-testnet-journal";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function newBinanceTestnetTradeId(): string {
  return `bn-tn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadBinanceTestnetJournalClient(): BinanceTestnetJournalEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(BINANCE_TESTNET_JOURNAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? (parsed as BinanceTestnetJournalEntry[])
      : [];
  } catch {
    return [];
  }
}

export function saveBinanceTestnetJournalClient(
  entries: BinanceTestnetJournalEntry[],
): void {
  if (!isBrowser()) return;
  localStorage.setItem(
    BINANCE_TESTNET_JOURNAL_KEY,
    JSON.stringify(entries.slice(0, 200)),
  );
}

export function appendBinanceTestnetJournalClient(
  entry: BinanceTestnetJournalEntry,
): BinanceTestnetJournalEntry[] {
  const next = [entry, ...loadBinanceTestnetJournalClient()];
  saveBinanceTestnetJournalClient(next);
  return next;
}

export function updateBinanceTestnetJournalClient(
  binanceTestnetTradeId: string,
  patch: Partial<BinanceTestnetJournalEntry>,
): BinanceTestnetJournalEntry | null {
  let updated: BinanceTestnetJournalEntry | null = null;
  const next = loadBinanceTestnetJournalClient().map((e) => {
    if (e.binanceTestnetTradeId !== binanceTestnetTradeId) return e;
    updated = { ...e, ...patch };
    return updated;
  });
  if (updated) saveBinanceTestnetJournalClient(next);
  return updated;
}
