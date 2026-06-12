import type { JournalEvent } from "@/lib/journal/journal-types";

function closeSource(evt: JournalEvent): string {
  return String((evt.payload as { source?: string }).source ?? "");
}

function closeRank(evt: JournalEvent): number {
  const source = closeSource(evt);
  if (source === "BINANCE_TESTNET") return 4;
  if (source === "JOURNAL_REPAIR") return 3;
  if (source === "RECONCILIATION_BACKFILL") return 1;
  return 2;
}

export function pickCanonicalPositionClosed(events: JournalEvent[]): JournalEvent {
  return [...events].sort((a, b) => {
    const rankDiff = closeRank(b) - closeRank(a);
    if (rankDiff !== 0) return rankDiff;
    return b.timestamp.localeCompare(a.timestamp);
  })[0];
}

export function groupPositionClosedByTrade(events: JournalEvent[]): Map<string, JournalEvent[]> {
  const grouped = new Map<string, JournalEvent[]>();
  for (const evt of events) {
    if (evt.type !== "POSITION_CLOSED" || !evt.tradeId) continue;
    const list = grouped.get(evt.tradeId) ?? [];
    list.push(evt);
    grouped.set(evt.tradeId, list);
  }
  return grouped;
}

export function getCanonicalPositionClosedByTrade(
  events: JournalEvent[],
): Map<string, JournalEvent> {
  const canonical = new Map<string, JournalEvent>();
  for (const [tradeId, closes] of groupPositionClosedByTrade(events)) {
    canonical.set(tradeId, pickCanonicalPositionClosed(closes));
  }
  return canonical;
}

export function listDuplicatePositionClosedTradeIds(events: JournalEvent[]): string[] {
  const duplicates: string[] = [];
  for (const [tradeId, closes] of groupPositionClosedByTrade(events)) {
    if (closes.length <= 1) continue;
    const nonBackfill = closes.filter((e) => closeSource(e) !== "RECONCILIATION_BACKFILL");
    if (nonBackfill.length > 1) duplicates.push(tradeId);
  }
  return duplicates;
}

export function findCanonicalPositionClosed(
  tradeId: string,
  events: JournalEvent[],
): JournalEvent | undefined {
  const closes = events.filter((e) => e.type === "POSITION_CLOSED" && e.tradeId === tradeId);
  if (closes.length === 0) return undefined;
  return pickCanonicalPositionClosed(closes);
}
