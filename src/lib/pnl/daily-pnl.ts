import type { JournalEvent } from "@/lib/journal/journal-types";

function utcDayBounds(now = new Date()): { start: string; end: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  ).toISOString();
  return { start, end };
}

export function sumDailyPnl(events: JournalEvent[], now = new Date()): number {
  const { start, end } = utcDayBounds(now);
  return events
    .filter((e) => e.type === "PNL_REALIZED" && e.timestamp >= start && e.timestamp < end)
    .reduce((sum, e) => sum + Number((e.payload as { netPnl?: number }).netPnl ?? 0), 0);
}
