import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import {
  appendMonitorJournalEvent,
  newMonitorJournalId,
} from "@/lib/testnet-monitor/monitor-journal-server";
import type { TestnetMonitorJournalEvent } from "@/lib/testnet-monitor/types";

const MAX_LINK_AGE_MS = 48 * 60 * 60 * 1000;

/** Link orphan journal rows to the nearest prior decision log entry (safe heuristic). */
export function backfillMissingDecisionLogIds(
  journal: BinanceTestnetJournalEntry[],
  decisions: DecisionLogEntry[],
): { journal: BinanceTestnetJournalEntry[]; linkedCount: number } {
  const sorted = [...decisions].sort(
    (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp),
  );
  let linkedCount = 0;

  const next = journal.map((entry) => {
    if (entry.decisionLogId) return entry;
    if (!["FILLED", "CLOSED", "CLOSING", "SUBMITTED"].includes(entry.status)) {
      return entry;
    }

    const anchor = entry.executedAt ?? entry.createdAt;
    const anchorMs = Date.parse(anchor);
    if (!Number.isFinite(anchorMs)) return entry;

    let best: DecisionLogEntry | null = null;
    let bestDelta = Infinity;
    for (const decision of sorted) {
      const decisionMs = Date.parse(decision.timestamp);
      if (!Number.isFinite(decisionMs)) continue;
      const delta = anchorMs - decisionMs;
      if (delta >= 0 && delta < bestDelta && delta <= MAX_LINK_AGE_MS) {
        bestDelta = delta;
        best = decision;
      }
    }

    if (!best) return entry;
    linkedCount += 1;
    const note = entry.operatorNote?.trim();
    return {
      ...entry,
      decisionLogId: best.id,
      operatorNote: note
        ? `${note} · decisionLogId backfilled`
        : "decisionLogId backfilled from nearest decision log entry.",
    };
  });

  return { journal: next, linkedCount };
}

/** Backfill monitor journal rows for legacy decisions missing linkage events. */
export async function backfillMissingMonitorEvents(input: {
  decisions: DecisionLogEntry[];
  monitorEvents: TestnetMonitorJournalEvent[];
  limit?: number;
}): Promise<{ createdCount: number; events: TestnetMonitorJournalEvent[] }> {
  const limit = input.limit ?? 30;
  const linked = new Set(
    input.monitorEvents
      .filter((e) => e.decisionLogId)
      .map((e) => e.decisionLogId as string),
  );

  const created: TestnetMonitorJournalEvent[] = [];
  for (const decision of input.decisions.slice(0, limit)) {
    if (linked.has(decision.id)) continue;

    const event: TestnetMonitorJournalEvent = {
      journalId: newMonitorJournalId(),
      timestamp: decision.timestamp,
      exchange: "BINANCE",
      environment: "TESTNET",
      eventType: "CENTRAL_ANALYSIS_COMPLETED",
      symbol: null,
      decisionLogId: decision.id,
      orderId: null,
      positionId: null,
      payload: {
        legacyBackfill: true,
        finalVerdict: decision.finalVerdict,
        advisoryOnly: true,
      },
    };
    await appendMonitorJournalEvent(event);
    created.push(event);
    linked.add(decision.id);
  }

  return {
    createdCount: created.length,
    events: [...created, ...input.monitorEvents],
  };
}
