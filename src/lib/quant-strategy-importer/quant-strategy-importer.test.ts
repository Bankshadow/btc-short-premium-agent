import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildQuantImporterCatalog } from "./build-catalog";
import { canTransitionImportStatus } from "./safety";
import { QUANT_STRATEGY_SEEDS } from "./seed-strategies";

describe("Quant Strategy Importer (MVP 66)", () => {
  it("seeds all 10 required strategies", () => {
    const names = QUANT_STRATEGY_SEEDS.map((s) => s.strategyName).sort();
    assert.deepEqual(names, [
      "Bollinger Bands Pattern Recognition",
      "Dual Thrust",
      "Heikin-Ashi",
      "London Breakout",
      "MACD Oscillator",
      "Monte Carlo",
      "Options Straddle",
      "Pair Trading",
      "Parabolic SAR",
      "RSI Pattern Recognition",
    ]);
  });

  it("builds research-only catalog with execution blocked", async () => {
    const catalog = await buildQuantImporterCatalog();
    assert.equal(catalog.strategies.length, 10);
    assert.equal(catalog.noLiveExecution, true);
    assert.equal(catalog.noAutoTrading, true);
    for (const card of catalog.strategies) {
      assert.equal(card.executionBlocked, true);
      assert.equal(card.humanApprovalRequired, true);
      assert.ok(card.aiReviewSummary.includes("BTC/SOL"));
      assert.ok(card.cryptoAdaptationNotes.length > 0);
    }
  });

  it("allows research → backtest promotion only with valid transitions", () => {
    assert.equal(
      canTransitionImportStatus("RESEARCH_ONLY", "READY_FOR_BACKTEST"),
      true,
    );
    assert.equal(
      canTransitionImportStatus("RESEARCH_ONLY", "READY_FOR_PAPER"),
      false,
    );
    assert.equal(canTransitionImportStatus("REJECTED", "RESEARCH_ONLY"), true);
  });
});
