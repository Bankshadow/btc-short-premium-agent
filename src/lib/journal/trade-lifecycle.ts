import type { DecisionLogEntry } from "./decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";

export type TradeLifecycleStatus =
  | "NONE"
  | "PAPER_OPEN"
  | "PAPER_CLOSED"
  | "SHADOW_OPEN"
  | "SHADOW_CLOSED";

export type TradeLifecycle = {
  status: TradeLifecycleStatus;
  orderId: string | null;
  label: string;
  pnlPct: number | null;
};

export function getTradeLifecycleForEntry(
  entryId: string,
  orders: PaperOrder[],
): TradeLifecycle {
  const order = orders.find((o) => o.decisionLogId === entryId);
  if (!order) {
    return { status: "NONE", orderId: null, label: "No linked trade", pnlPct: null };
  }

  const isShadow = order.paperMode === "RELAXED_PAPER";
  const kind = isShadow ? "Shadow" : "Paper";

  if (order.status === "OPEN") {
    return {
      status: isShadow ? "SHADOW_OPEN" : "PAPER_OPEN",
      orderId: order.id,
      label: `${kind} open`,
      pnlPct: order.unrealizedPnlPct,
    };
  }

  return {
    status: isShadow ? "SHADOW_CLOSED" : "PAPER_CLOSED",
    orderId: order.id,
    label: `${kind} closed`,
    pnlPct: order.realizedPnlPct,
  };
}

export function linkOrdersToEntry(
  entry: DecisionLogEntry,
  orders: PaperOrder[],
): DecisionLogEntry & { tradeLifecycle: TradeLifecycle } {
  return {
    ...entry,
    tradeLifecycle: getTradeLifecycleForEntry(entry.id, orders),
  };
}
