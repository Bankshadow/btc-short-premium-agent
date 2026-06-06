import type { BinancePosition, BinanceTestnetJournalEntry } from "./binance-types";

export interface BinancePositionMonitorReport {
  openPositions: BinancePosition[];
  openCount: number;
  symbolsWithExposure: string[];
  journalOpen: BinanceTestnetJournalEntry[];
  mismatches: string[];
  healthy: boolean;
}

export function reconcileBinancePositions(input: {
  positions: BinancePosition[];
  journal: BinanceTestnetJournalEntry[];
}): BinancePositionMonitorReport {
  const openPositions = input.positions.filter(
    (p) => Math.abs(Number(p.positionAmt)) > 0,
  );
  const symbolsWithExposure = openPositions.map((p) => p.symbol);

  const journalOpen = input.journal.filter((j) =>
    ["SUBMITTED", "FILLED", "CLOSING"].includes(j.status),
  );

  const mismatches: string[] = [];
  for (const trade of journalOpen) {
    const pos = openPositions.find((p) => p.symbol === trade.symbol);
    if (!pos && trade.status === "FILLED") {
      mismatches.push(
        `Journal ${trade.binanceTestnetTradeId} FILLED but no exchange position for ${trade.symbol}`,
      );
    }
  }

  for (const pos of openPositions) {
    const linked = journalOpen.some((j) => j.symbol === pos.symbol);
    if (!linked) {
      mismatches.push(
        `Exchange position on ${pos.symbol} (${pos.positionAmt}) has no matching journal entry`,
      );
    }
  }

  return {
    openPositions,
    openCount: openPositions.length,
    symbolsWithExposure,
    journalOpen,
    mismatches,
    healthy: mismatches.length === 0,
  };
}

export function closeSideForPosition(positionAmt: number): "BUY" | "SELL" {
  return positionAmt > 0 ? "SELL" : "BUY";
}
