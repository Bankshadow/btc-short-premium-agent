import type { BinancePosition, BinanceTestnetJournalEntry } from "./binance-types";
import { newBinanceTestnetTradeId } from "./binance-testnet-journal-server";

const OPEN_JOURNAL_STATUSES = new Set(["SUBMITTED", "FILLED", "CLOSING"]);

function openJournalForSymbol(
  journal: BinanceTestnetJournalEntry[],
  symbol: string,
): BinanceTestnetJournalEntry | undefined {
  return journal.find(
    (j) => j.symbol === symbol && OPEN_JOURNAL_STATUSES.has(j.status),
  );
}

function backfillPreviewId(symbol: string): string {
  return `backfill-reconcile-${symbol}`;
}

export function buildBackfillJournalEntry(
  position: BinancePosition,
): BinanceTestnetJournalEntry {
  const amt = Number(position.positionAmt);
  const absAmt = Math.abs(amt);
  const mark = Number(position.markPrice) || Number(position.entryPrice) || 0;
  const notionalUsd =
    Math.abs(Number(position.notional)) || absAmt * mark || 0;
  const now = new Date().toISOString();

  return {
    binanceTestnetTradeId: newBinanceTestnetTradeId(),
    previewId: backfillPreviewId(position.symbol),
    symbol: position.symbol,
    side: amt > 0 ? "BUY" : "SELL",
    notionalUsd: Number(notionalUsd.toFixed(2)),
    quantity: String(absAmt),
    status: "FILLED",
    source: "manual_test",
    reason: "Backfilled from exchange reconcile — position existed without journal entry.",
    decisionLogId: null,
    exchangeOrderId: null,
    clientOrderId: null,
    operatorNote: "Auto backfill during testnet monitor reconcile.",
    blockReasons: [],
    createdAt: now,
    executedAt: now,
    closedAt: null,
    realizedPnl: null,
    fees: null,
    previewPrice: mark || null,
    markPriceAtSubmit: mark || null,
    fillPrice: Number(position.entryPrice) || mark || null,
    slippage: null,
    slippageBps: null,
    latencyMs: null,
    partialFill: false,
    duplicateSubmission: false,
    retryCount: 0,
    closeAttempt: false,
    closeFailed: false,
  };
}

/** Adds FILLED journal rows for exchange positions missing open ledger entries. */
export function backfillOrphanBinanceJournalEntries(input: {
  positions: BinancePosition[];
  journal: BinanceTestnetJournalEntry[];
}): {
  journal: BinanceTestnetJournalEntry[];
  backfilledSymbols: string[];
} {
  const openPositions = input.positions.filter(
    (p) => Math.abs(Number(p.positionAmt)) > 0,
  );
  const backfilledSymbols: string[] = [];
  let journal = [...input.journal];

  for (const pos of openPositions) {
    if (openJournalForSymbol(journal, pos.symbol)) continue;
    journal = [buildBackfillJournalEntry(pos), ...journal];
    backfilledSymbols.push(pos.symbol);
  }

  return { journal, backfilledSymbols };
}
