import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TOURNAMENT_CONTESTANTS } from "./contestants";
import { classifyTournamentStrategy } from "./classify-strategy";
import { buildRankingMetrics } from "./score-ranking";
import type { QuantBacktestMetrics } from "@/lib/quant-backtest/types";

const sampleMetrics: QuantBacktestMetrics = {
  totalReturnPct: 5,
  winRate: 55,
  maxDrawdownPct: 8,
  profitFactor: 1.4,
  averageWinPct: 1.2,
  averageLossPct: -0.8,
  tradeCount: 12,
  expectancyPct: 0.4,
};

describe("Strategy Tournament (MVP 68)", () => {
  it("includes six tournament contestants", () => {
    assert.equal(TOURNAMENT_CONTESTANTS.length, 6);
    const ids = TOURNAMENT_CONTESTANTS.map((c) => c.sourceId);
    assert.ok(ids.includes("macd-oscillator"));
    assert.ok(ids.includes("ai-desk-options-premium"));
  });

  it("builds composite ranking scores", () => {
    const ranking = buildRankingMetrics({
      metrics: sampleMetrics,
      trades: [],
      barsLoaded: 200,
      meta: TOURNAMENT_CONTESTANTS[0],
      peerReturns: [5, 2, -1],
      peerDrawdowns: [8, 12, 20],
    });
    assert.ok(ranking.compositeScore > 0);
    assert.ok(ranking.netReturnScore >= 0);
  });

  it("classifies winner as candidate when strong", () => {
    const ranking = buildRankingMetrics({
      metrics: sampleMetrics,
      trades: [
        {
          id: "1",
          direction: "LONG",
          entryTime: "a",
          exitTime: "b",
          entryPrice: 100,
          exitPrice: 101,
          grossPnlPct: 1,
          netPnlPct: 0.8,
          frictionCostPct: 0.2,
          regime: "bullish",
          barsHeld: 2,
        },
      ],
      barsLoaded: 200,
      meta: TOURNAMENT_CONTESTANTS[0],
      peerReturns: [5, 1],
      peerDrawdowns: [8, 15],
    });
    const result = classifyTournamentStrategy({
      metrics: sampleMetrics,
      ranking,
      meta: TOURNAMENT_CONTESTANTS[0],
      rank: 1,
      barsLoaded: 200,
      totalContestants: 6,
    });
    assert.equal(result.classification, "CANDIDATE_TESTNET");
  });

  it("rejects weak strategies with reasons", () => {
    const weak: QuantBacktestMetrics = {
      ...sampleMetrics,
      totalReturnPct: -4,
      profitFactor: 0.7,
      tradeCount: 8,
    };
    const ranking = buildRankingMetrics({
      metrics: weak,
      trades: [],
      barsLoaded: 200,
      meta: TOURNAMENT_CONTESTANTS[3],
      peerReturns: [-4, 2],
      peerDrawdowns: [20, 8],
    });
    const result = classifyTournamentStrategy({
      metrics: weak,
      ranking,
      meta: TOURNAMENT_CONTESTANTS[3],
      rank: 6,
      barsLoaded: 200,
      totalContestants: 6,
    });
    assert.equal(result.classification, "REJECT");
    assert.ok(result.rejectionReasons.length > 0);
  });
});
