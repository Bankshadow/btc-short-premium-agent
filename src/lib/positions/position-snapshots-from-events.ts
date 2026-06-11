import type { JournalEvent } from "@/lib/journal/journal-types";
import type { PositionSnapshot } from "./position-types";

function monitoredPayload(evt: JournalEvent): Partial<PositionSnapshot> {
  return evt.payload as Partial<PositionSnapshot>;
}

export function snapshotFromMonitoredEvent(evt: JournalEvent): PositionSnapshot | null {
  if (evt.type !== "POSITION_MONITORED" || !evt.tradeId) return null;
  const p = monitoredPayload(evt);
  return {
    positionId: evt.positionId ?? String(p.positionId ?? ""),
    tradeId: evt.tradeId,
    previewId: evt.previewId ?? String(p.previewId ?? ""),
    runId: evt.runId ?? String(p.runId ?? ""),
    decisionLogId: evt.decisionLogId ?? String(p.decisionLogId ?? ""),
    environment: "TESTNET",
    symbol: String(p.symbol ?? ""),
    side: (p.side as PositionSnapshot["side"]) ?? "SHORT",
    qty: String(p.qty ?? "0"),
    entryPrice: p.entryPrice != null ? Number(p.entryPrice) : null,
    markPrice: p.markPrice != null ? Number(p.markPrice) : null,
    notionalUsd: p.notionalUsd != null ? Number(p.notionalUsd) : null,
    unrealizedPnl: p.unrealizedPnl != null ? Number(p.unrealizedPnl) : null,
    unrealizedPnlPct: p.unrealizedPnlPct != null ? Number(p.unrealizedPnlPct) : null,
    leverage: p.leverage != null ? Number(p.leverage) : null,
    source: "BINANCE_TESTNET",
    refreshedAt: String(p.refreshedAt ?? evt.timestamp),
    status: (p.status as PositionSnapshot["status"]) ?? "UNKNOWN",
  };
}

export function getLatestMonitoredSnapshots(
  events: JournalEvent[],
): Map<string, PositionSnapshot> {
  const map = new Map<string, PositionSnapshot>();
  for (const evt of events) {
    if (evt.type !== "POSITION_MONITORED" || !evt.tradeId) continue;
    const snap = snapshotFromMonitoredEvent(evt);
    if (snap) map.set(evt.tradeId, snap);
  }
  return map;
}

export function getLatestMonitoredAt(events: JournalEvent[]): string | null {
  const monitored = events.filter((e) => e.type === "POSITION_MONITORED");
  if (monitored.length === 0) return null;
  return monitored.reduce(
    (latest, e) => (e.timestamp.localeCompare(latest) > 0 ? e.timestamp : latest),
    monitored[0].timestamp,
  );
}
