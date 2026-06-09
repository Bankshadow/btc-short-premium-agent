import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  backfillOrphanBinanceJournalEntries,
  buildBackfillJournalEntry,
} from "./binance-journal-backfill";
import type { BinancePosition } from "./binance-types";

describe("Binance journal backfill", () => {
  it("creates FILLED entries for orphan exchange positions", () => {
    const positions: BinancePosition[] = [
      {
        symbol: "DOGEUSDT",
        positionAmt: "637",
        entryPrice: "0.12",
        markPrice: "0.13",
        unRealizedProfit: "1",
        leverage: "5",
        positionSide: "BOTH",
        notional: "82",
      },
    ];
    const { journal, backfilledSymbols } = backfillOrphanBinanceJournalEntries({
      positions,
      journal: [],
    });
    assert.deepEqual(backfilledSymbols, ["DOGEUSDT"]);
    assert.equal(journal.length, 1);
    assert.equal(journal[0]?.status, "FILLED");
    assert.equal(journal[0]?.side, "BUY");
    assert.equal(journal[0]?.source, "manual_test");
  });

  it("does not duplicate backfill for the same symbol", () => {
    const pos: BinancePosition = {
      symbol: "LINKUSDT",
      positionAmt: "-6.97",
      entryPrice: "14",
      markPrice: "14.2",
      unRealizedProfit: "-1",
      leverage: "5",
      positionSide: "BOTH",
      notional: "98",
    };
    const first = backfillOrphanBinanceJournalEntries({
      positions: [pos],
      journal: [],
    });
    const second = backfillOrphanBinanceJournalEntries({
      positions: [pos],
      journal: first.journal,
    });
    assert.equal(second.backfilledSymbols.length, 0);
    assert.equal(second.journal.length, 1);
  });

  it("maps short positions to SELL side", () => {
    const entry = buildBackfillJournalEntry({
      symbol: "BTCUSDT",
      positionAmt: "-0.01",
      entryPrice: "90000",
      markPrice: "90100",
      unRealizedProfit: "-1",
      leverage: "5",
      positionSide: "BOTH",
      notional: "900",
    });
    assert.equal(entry.side, "SELL");
  });
});
