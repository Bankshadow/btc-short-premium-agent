import type { JournalEvent } from "@/lib/journal/journal-types";
import { getLatestMonitoredSnapshots } from "@/lib/positions/position-snapshots-from-events";

export function parseQty(qty: string | undefined | null): number {
  const n = Number.parseFloat(String(qty ?? ""));
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

function pickNonZeroQty(...candidates: Array<string | undefined | null>): string {
  for (const candidate of candidates) {
    if (parseQty(candidate) > 0) return String(candidate);
  }
  return String(candidates.find((c) => c != null && c !== "") ?? "0");
}

function pickPositivePrice(...candidates: Array<number | null | undefined>): number | null {
  for (const candidate of candidates) {
    if (candidate != null && Number.isFinite(candidate) && candidate > 0) return candidate;
  }
  return null;
}

export function resolveOpenTradeFill(
  tradeId: string,
  events: JournalEvent[],
  order: {
    qty?: string;
    quantity?: string;
    entryPrice?: number | null;
    avgPrice?: number | string | null;
  },
  openPayload: { qty?: string; entryPrice?: number | null },
): { qty: string; entryPrice: number | null } {
  const monitored = getLatestMonitoredSnapshots(events).get(tradeId);
  const monitoredQty =
    monitored?.status === "OPEN" && parseQty(monitored.qty) > 0 ? monitored.qty : undefined;

  return {
    qty: pickNonZeroQty(order.qty, order.quantity, openPayload.qty, monitoredQty),
    entryPrice: pickPositivePrice(
      openPayload.entryPrice,
      order.entryPrice,
      order.avgPrice != null ? Number(order.avgPrice) : null,
      monitored?.entryPrice,
    ),
  };
}

export function resolveClosedTradeFill(
  tradeId: string,
  events: JournalEvent[],
  closedAt: string,
  order: {
    qty?: string;
    quantity?: string;
    entryPrice?: number | null;
    avgPrice?: number | string | null;
  },
  openPayload: { qty?: string; entryPrice?: number | null },
  closePayload: { executedQty?: string; qty?: string; avgPrice?: number | string },
): { qty: string; entryPrice: number | null; exitPrice: number | null } {
  const monitoredBeforeClose = events
    .filter(
      (e) =>
        e.tradeId === tradeId &&
        e.type === "POSITION_MONITORED" &&
        e.timestamp.localeCompare(closedAt) <= 0,
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  const monitored = monitoredBeforeClose?.payload as
    | { qty?: string; entryPrice?: number | null }
    | undefined;

  return {
    qty: pickNonZeroQty(
      order.qty,
      order.quantity,
      openPayload.qty,
      closePayload.executedQty,
      closePayload.qty,
      monitored?.qty,
    ),
    entryPrice: pickPositivePrice(
      openPayload.entryPrice,
      order.entryPrice,
      order.avgPrice != null ? Number(order.avgPrice) : null,
      monitored?.entryPrice,
    ),
    exitPrice: pickPositivePrice(
      closePayload.avgPrice != null ? Number(closePayload.avgPrice) : null,
    ),
  };
}
