import type {
  ExchangeOpenOrderSnapshot,
  ExchangePositionSnapshot,
} from "@/lib/exchange/types";
import type {
  OptionsTestnetJournalEntry,
  OptionsTestnetReconcileReport,
} from "./types";

export function reconcileOptionsTestnetState(input: {
  journal: OptionsTestnetJournalEntry[];
  positions: ExchangePositionSnapshot[];
  orders: ExchangeOpenOrderSnapshot[];
}): OptionsTestnetReconcileReport {
  const mismatches: string[] = [];
  const positionBySymbol = new Map(
    input.positions.map((p) => [p.symbol, p]),
  );
  const orderIds = new Set(input.orders.map((o) => o.orderId));

  const updatedEntries = input.journal.map((entry) => {
    if (entry.status === "BLOCKED" || entry.status === "FAILED") {
      return entry;
    }

    const pos = positionBySymbol.get(entry.symbol);
    const hasOpenOrder =
      entry.exchangeOrderId != null && orderIds.has(entry.exchangeOrderId);

    if (entry.status === "CLOSING") {
      if (!pos || pos.size <= 0) {
        return {
          ...entry,
          status: "CLOSED" as const,
          closedAt: entry.closedAt ?? new Date().toISOString(),
        };
      }
      return { ...entry, status: "CLOSING" as const };
    }

    if (pos && pos.size > 0) {
      return { ...entry, status: "OPEN" as const };
    }

    if (hasOpenOrder) {
      return { ...entry, status: "SUBMITTED" as const };
    }

    if (
      entry.status === "SUBMITTED" ||
      entry.status === "OPEN" ||
      entry.status === "FILLED"
    ) {
      if (!pos) {
        mismatches.push(
          `Trade ${entry.optionsTestnetTradeId}: journal ${entry.status} but no exchange position for ${entry.symbol}`,
        );
        return {
          ...entry,
          status: "RECONCILED" as const,
          closedAt: entry.closedAt ?? new Date().toISOString(),
        };
      }
    }

    return entry;
  });

  return {
    reconciledAt: new Date().toISOString(),
    journalCount: input.journal.length,
    openPositions: input.positions.length,
    openOrders: input.orders.length,
    mismatches,
    updatedEntries,
  };
}
