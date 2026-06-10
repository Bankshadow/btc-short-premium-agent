import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EvidenceProgressRow } from "@/lib/evidence-progress/types";
import {
  blocksTestnetEntriesForHealth,
  buildStrategyHealthReportForTag,
} from "./build-strategy-health-report";
import { STRATEGY_HEALTH_EVIDENCE_REQUIRED } from "./types";

function evidenceRow(
  partial: Partial<EvidenceProgressRow> & Pick<EvidenceProgressRow, "tradeId">,
): EvidenceProgressRow {
  return {
    symbol: partial.symbol ?? "BTCUSDT",
    side: partial.side ?? "LONG",
    result: partial.result ?? "WIN",
    netPnl: partial.netPnl ?? 2,
    grossPnl: partial.grossPnl ?? 2,
    strategy: partial.strategy ?? "ai_signal",
    decisionLogId: partial.decisionLogId ?? "dl-1",
    closeReason: partial.closeReason ?? null,
    learningStatus: "PENDING_REVIEW",
    openedAt: "2026-01-01T00:00:00.000Z",
    closedAt: partial.closedAt ?? "2026-01-01T01:00:00.000Z",
    valid: true,
    evidenceIndex: partial.evidenceIndex ?? 1,
    tradeId: partial.tradeId,
    ...partial,
  };
}

describe("Integrated strategy health (MVP 74)", () => {
  it("returns NEEDS_MORE_DATA below 12 trades", () => {
    const trades = Array.from({ length: 8 }, (_, i) =>
      evidenceRow({
        tradeId: `t-${i}`,
        decisionLogId: `dl-${i}`,
        evidenceIndex: i + 1,
      }),
    );
    const report = buildStrategyHealthReportForTag({
      strategyTag: "ai_signal",
      trades,
      decisions: [],
      learningRecords: [],
      qualityByDecision: new Map(),
    });
    assert.equal(report.status, "NEEDS_MORE_DATA");
    assert.equal(report.evidenceCount, 8);
  });

  it("evaluates CONTINUE with strong 12-trade evidence", () => {
    const trades = Array.from({ length: STRATEGY_HEALTH_EVIDENCE_REQUIRED }, (_, i) =>
      evidenceRow({
        tradeId: `t-${i}`,
        decisionLogId: `dl-${i}`,
        evidenceIndex: i + 1,
        netPnl: i % 3 === 0 ? -1 : 3,
        result: i % 3 === 0 ? "LOSS" : "WIN",
        closeReason: i % 3 === 0 ? "Stop loss" : "Take profit",
      }),
    );
    const report = buildStrategyHealthReportForTag({
      strategyTag: "ai_signal",
      trades,
      decisions: [],
      learningRecords: [],
      qualityByDecision: new Map(),
    });
    assert.equal(report.evidenceCount, 12);
    assert.ok(["CONTINUE", "REDUCE_RISK"].includes(report.status));
    assert.ok(report.linkedTradeIds.length === 12);
  });

  it("blocks testnet entries on PAUSE and REJECT only", () => {
    assert.equal(
      blocksTestnetEntriesForHealth({
        reportId: "r",
        strategyTag: "ai_signal",
        status: "NEEDS_MORE_DATA",
        evidenceCount: 5,
        winRate: 50,
        profitFactor: 1,
        maxDrawdown: 0,
        avgWin: 1,
        avgLoss: 1,
        biggestWeakness: null,
        bestPattern: null,
        recommendation: "",
        nextAction: "",
        linkedDecisionIds: [],
        linkedTradeIds: [],
        linkedLearningRecordIds: [],
        avgTradeQualityScore: null,
        riskVetoRate: 0,
        agentTradeAgreementRate: 0,
        netPnl: 0,
        reviewedAt: "",
      }),
      false,
    );
    assert.equal(
      blocksTestnetEntriesForHealth({
        reportId: "r",
        strategyTag: "ai_signal",
        status: "PAUSE",
        evidenceCount: 12,
        winRate: 40,
        profitFactor: 0.9,
        maxDrawdown: 10,
        avgWin: 1,
        avgLoss: 2,
        biggestWeakness: "losses",
        bestPattern: null,
        recommendation: "pause",
        nextAction: "review",
        linkedDecisionIds: [],
        linkedTradeIds: [],
        linkedLearningRecordIds: [],
        avgTradeQualityScore: null,
        riskVetoRate: 0,
        agentTradeAgreementRate: 0,
        netPnl: -5,
        reviewedAt: "",
      }),
      true,
    );
  });
});
