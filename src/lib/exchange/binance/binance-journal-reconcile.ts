import type { BinancePosition, BinanceTestnetJournalEntry } from "./binance-types";
import { saveServerBinanceTestnetJournal } from "./binance-testnet-journal-server";

export function computeCloseRealizedPnl(input: {
  side: "BUY" | "SELL";
  quantity: string;
  entryPrice: number;
  exitPrice: number;
}): number {
  const qty = Math.abs(Number(input.quantity));
  if (qty <= 0 || input.entryPrice <= 0 || input.exitPrice <= 0) return 0;
  const isLong = input.side === "BUY";
  const priceDiff = isLong
    ? input.exitPrice - input.entryPrice
    : input.entryPrice - input.exitPrice;
  return Number((priceDiff * qty).toFixed(4));
}

export function reconcileBinanceJournalStatuses(
  journal: BinanceTestnetJournalEntry[],
  positions: BinancePosition[],
): BinanceTestnetJournalEntry[] {
  const positionBySymbol = new Map(
    positions
      .filter((p) => Math.abs(Number(p.positionAmt)) > 0)
      .map((p) => [p.symbol, p]),
  );
  const openSymbols = new Set(positionBySymbol.keys());

  return journal.map((entry) => {
    if (entry.status === "CLOSING" && !openSymbols.has(entry.symbol)) {
      const pos = positionBySymbol.get(entry.symbol);
      const entryPrice = Number(pos?.entryPrice ?? entry.fillPrice ?? entry.previewPrice ?? 0);
      const exitPrice = Number(
        entry.markPriceAtSubmit ?? pos?.markPrice ?? entry.previewPrice ?? 0,
      );
      const pnl =
        entry.realizedPnl ??
        (entryPrice > 0 && exitPrice > 0
          ? computeCloseRealizedPnl({
              side: entry.side,
              quantity: entry.quantity,
              entryPrice,
              exitPrice,
            })
          : entry.notionalUsd
            ? entry.notionalUsd * 0.001
            : 0);

      return {
        ...entry,
        status: "CLOSED" as const,
        closedAt: entry.closedAt ?? new Date().toISOString(),
        realizedPnl: pnl,
        fillPrice: exitPrice > 0 ? exitPrice : entry.fillPrice,
      };
    }

    if (
      (entry.status === "SUBMITTED" || entry.status === "FILLED") &&
      openSymbols.has(entry.symbol)
    ) {
      return { ...entry, status: "FILLED" as const };
    }

    return entry;
  });
}

export async function persistReconciledBinanceJournal(input: {
  journal: BinanceTestnetJournalEntry[];
  positions: BinancePosition[];
}): Promise<BinanceTestnetJournalEntry[]> {
  const reconciled = reconcileBinanceJournalStatuses(input.journal, input.positions);
  const changed =
    JSON.stringify(reconciled) !== JSON.stringify(input.journal);
  if (changed) {
    await saveServerBinanceTestnetJournal(reconciled);
  }
  return reconciled;
}

/** Prefer the original open row — ignore legacy `-close` append duplicates. */
export function findOpenJournalEntryForSymbol(
  journal: BinanceTestnetJournalEntry[],
  symbol: string,
): BinanceTestnetJournalEntry | undefined {
  return journal.find(
    (j) =>
      j.symbol === symbol &&
      ["SUBMITTED", "FILLED"].includes(j.status) &&
      !j.binanceTestnetTradeId.includes("-close"),
  );
}
