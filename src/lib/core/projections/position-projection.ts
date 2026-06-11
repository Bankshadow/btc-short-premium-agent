import type { JournalEvent } from "@/lib/journal/journal-types";
import { getLatestMonitoredSnapshots } from "@/lib/positions/position-snapshots-from-events";
import { applyTradeReconciliation } from "../trade-reconciliation";

export interface PositionProjection {
  openTradeCount: number;
  snapshots: ReturnType<typeof getLatestMonitoredSnapshots> extends Map<string, infer V>
    ? V[]
    : never;
}

export function buildPositionProjection(events: JournalEvent[]): PositionProjection {
  const reconciled = applyTradeReconciliation(events);
  const map = getLatestMonitoredSnapshots(events);
  return {
    openTradeCount: reconciled.effectiveOpenCount,
    snapshots: Array.from(map.values()),
  };
}

export function zeroPositionProjection(): PositionProjection {
  return { openTradeCount: 0, snapshots: [] };
}
