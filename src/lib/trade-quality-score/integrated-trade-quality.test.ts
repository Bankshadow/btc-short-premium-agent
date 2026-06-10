import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { buildIntegratedTradeQualitySnapshot } from "./sync-trade-quality-from-closed";
import { buildTestnetClosedTradeQualityScore } from "./score-testnet-closed-trade";

function journal(overrides: Partial<BinanceTestnetJournalEntry> = {}): BinanceTestnetJournalEntry {
  return {
    binanceTestnetTradeId: "tn-trade-1",
    symbol: "BTCUSDT",
    side: "SELL",
    quantity: "0.01",
    status: "CLOSED",
    createdAt: new Date().toISOString(),
    executedAt: new Date().toISOString(),
    closedAt: new Date().toISOString(),
    realizedPnl: 12.5,
    notionalUsd: 500,
    decisionLogId: "log-1",
    reason: "Premium fade setup",
    blockReasons: [],
    source: "AUTO_TESTNET",
    ...overrides,
  } as BinanceTestnetJournalEntry;
}

function decision(overrides: Partial<DecisionLogEntry> = {}): DecisionLogEntry {
  return {
    id: "log-1",
    timestamp: new Date().toISOString(),
    btcPrice: 65000,
    marketRegime: "TREND_UP",
    agentOutputs: [],
    finalVerdict: "TRADE",
    riskVeto: false,
    topReasons: ["Strong setup"],
    actionPlan: "Enter short",
    outcomeStatus: "RESOLVED",
    paperPnl: 2,
    ...overrides,
  } as DecisionLogEntry;
}

describe("Integrated trade quality (MVP 76)", () => {
  it("scores testnet closed trade with decision link", () => {
    const score = buildTestnetClosedTradeQualityScore({
      journal: journal(),
      decision: decision(),
    });
    assert.equal(score.tradeId, "tn-trade-1");
    assert.equal(score.decisionLogId, "log-1");
    assert.equal(score.source, "testnet_closed");
    assert.ok(score.numericScore != null && score.numericScore >= 0);
    assert.ok(["A", "B", "C", "D", "F"].includes(score.grade));
    assert.ok(score.reasoningConsistency != null);
    assert.ok(Array.isArray(score.strengths));
    assert.ok(Array.isArray(score.weaknesses));
  });

  it("penalizes rule violations and missing decision data", () => {
    const withDecision = buildTestnetClosedTradeQualityScore({
      journal: journal(),
      decision: decision(),
    });
    const violated = buildTestnetClosedTradeQualityScore({
      journal: journal({
        blockReasons: ["risk_cap", "duplicate_gate"],
        duplicateSubmission: true,
        closeFailed: true,
      }),
      decision: decision(),
    });
    const missingDecision = buildTestnetClosedTradeQualityScore({
      journal: journal({ decisionLogId: null }),
    });
    assert.ok(violated.compositeScore < withDecision.compositeScore);
    assert.ok((missingDecision.dataConfidence ?? 1) < 1);
    assert.ok(missingDecision.compositeScore <= withDecision.compositeScore);
  });

  it("builds integrated snapshot for reports and mission flow", () => {
    const score = buildTestnetClosedTradeQualityScore({
      journal: journal(),
      decision: decision(),
    });
    const snapshot = buildIntegratedTradeQualitySnapshot({ scores: [score] });
    assert.equal(snapshot.mvp, 76);
    assert.equal(snapshot.autoStrategyChangeAllowed, false);
    assert.equal(snapshot.summary.sampleCount, 1);
    assert.equal(snapshot.scoresByTradeId["tn-trade-1"]?.grade, score.grade);
    assert.equal(snapshot.summary.testnetScoredCount, 1);
  });
});
