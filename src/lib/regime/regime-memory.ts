import type { JournalEvent } from "@/lib/journal/journal-types";
import { tagTradeFromEvents } from "@/lib/strategy/strategy-tagging";
import type { RegimeMemoryEntry, RegimeMemoryResult, RegimeTag } from "./regime-types";

function mapStrategyRegimeToRegimeTag(setup: string, regime: string): RegimeTag {
  if (regime === "TREND") return "TRENDING_UP";
  if (regime === "RANGE") return "RANGE";
  if (setup === "SHORT_PREMIUM") return "HIGH_VOLATILITY";
  return "UNKNOWN";
}

export function buildRegimeMemoryFromEvents(events: JournalEvent[]): RegimeMemoryEntry[] {
  const closed = events.filter((e) => e.type === "POSITION_CLOSED");
  const entries: RegimeMemoryEntry[] = [];

  for (const evt of closed) {
    if (!evt.tradeId) continue;
    const pnlEvt = events.find(
      (e) => e.type === "PNL_REALIZED" && e.tradeId === evt.tradeId,
    );
    const learnEvt = events.find(
      (e) =>
        (e.type === "LEARNING_RECORD_CREATED" || e.type === "LEARNING_CREATED") &&
        e.tradeId === evt.tradeId,
    );
    const tag = tagTradeFromEvents(evt.tradeId, events);
    const payload = pnlEvt?.payload as { netPnl?: number; result?: string } | undefined;
    const lessonPayload = learnEvt?.payload as { lessonSummary?: string } | undefined;

    entries.push({
      tradeId: evt.tradeId,
      regime: mapStrategyRegimeToRegimeTag(tag.setup, tag.regime),
      result: String(payload?.result ?? "UNKNOWN"),
      netPnl: Number(payload?.netPnl ?? 0),
      lesson: lessonPayload?.lessonSummary ?? null,
      closedAt: evt.timestamp,
    });
  }

  return entries.sort((a, b) => b.closedAt.localeCompare(a.closedAt));
}

export function retrieveSimilarRegimeTrades(
  currentRegime: RegimeTag,
  memory: RegimeMemoryEntry[],
  limit = 5,
): RegimeMemoryResult {
  const similar =
    currentRegime === "UNKNOWN"
      ? memory.slice(0, limit)
      : memory.filter((m) => m.regime === currentRegime).slice(0, limit);

  const lessons = similar
    .map((s) => s.lesson)
    .filter((l): l is string => Boolean(l))
    .slice(0, 5);

  return {
    currentRegime,
    similarTrades: similar,
    lessons,
    retrievedAt: new Date().toISOString(),
  };
}
