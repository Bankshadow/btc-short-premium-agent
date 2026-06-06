import type { DecisionLogEntry } from "./decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";

/** Entries that count toward live readiness, validation, and capital scaling. */
export function filterProductionEntries(
  entries: DecisionLogEntry[],
): DecisionLogEntry[] {
  return entries.filter((e) => !e.isDemoData);
}

export function filterProductionOrders(orders: PaperOrder[]): PaperOrder[] {
  return orders.filter((o) => !o.isDemoData);
}

export function countProductionResolved(entries: DecisionLogEntry[]): number {
  return filterProductionEntries(entries).filter(
    (e) => e.outcomeStatus === "RESOLVED",
  ).length;
}
