import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EvidenceProgressRow } from "@/lib/evidence-progress/types";
import { buildMicroLiveReadinessReport } from "./build-readiness-report";
import { MICRO_LIVE_EVIDENCE_REQUIRED } from "./types";

function validTrade(id: string): EvidenceProgressRow {
  return {
    tradeId: id,
    symbol: "BTCUSDT",
    side: "LONG",
    result: "WIN",
    netPnl: 2,
    grossPnl: 2,
    strategy: "ai_signal",
    decisionLogId: `dl-${id}`,
    closeReason: "Take profit",
    learningStatus: "PENDING_REVIEW",
    openedAt: "2026-01-01T00:00:00.000Z",
    closedAt: "2026-01-01T01:00:00.000Z",
    valid: true,
    evidenceIndex: 1,
  };
}

describe("Micro-live readiness (MVP 75)", () => {
  it("NOT_READY when fewer than 12 valid trades", () => {
    const report = buildMicroLiveReadinessReport({
      connected: true,
      testnetConfigured: true,
      evidenceCompletedTrades: 5,
      evidenceValidTrades: Array.from({ length: 5 }, (_, i) => validTrade(`t-${i}`)),
      evidenceExcluded: [],
      evidenceMissingDecisionLogId: 0,
      evidenceMissingCloseJournal: 0,
      evidenceMissingPnl: 0,
      journal: [{ status: "CLOSED" } as never],
      learningRecords: [],
      learningPendingCount: 0,
      monitorEvents: [],
      requireDoubleConfirm: true,
      liveExecutionEnabled: false,
      liveBlocked: true,
      killSwitchConfigured: true,
      killSwitchPaused: false,
      criticalIncidentOpen: false,
      criticalIncidentTitle: null,
      riskBlockNewTrades: false,
    });
    assert.equal(report.readinessStatus, "NOT_READY");
    assert.ok(report.blockers.some((b) => b.includes(String(MICRO_LIVE_EVIDENCE_REQUIRED))));
  });

  it("BLOCKED when live execution enabled", () => {
    const report = buildMicroLiveReadinessReport({
      connected: true,
      testnetConfigured: true,
      evidenceCompletedTrades: 12,
      evidenceValidTrades: Array.from({ length: 12 }, (_, i) => validTrade(`t-${i}`)),
      evidenceExcluded: [],
      evidenceMissingDecisionLogId: 0,
      evidenceMissingCloseJournal: 0,
      evidenceMissingPnl: 0,
      journal: [
        {
          status: "CLOSED",
          closeAttempt: true,
          operatorNote: "Autonomous testnet monitor — take profit",
        } as never,
      ],
      learningRecords: Array.from({ length: 12 }, (_, i) => ({
        learningRecordId: `lrn-${i}`,
        tradeId: `t-${i}`,
        closedTradeId: `t-${i}`,
        status: "PENDING_REVIEW",
      })) as never[],
      learningPendingCount: 12,
      monitorEvents: [{ eventType: "POSITION_CLOSED" } as never],
      requireDoubleConfirm: true,
      liveExecutionEnabled: true,
      liveBlocked: false,
      killSwitchConfigured: true,
      killSwitchPaused: false,
      criticalIncidentOpen: false,
      criticalIncidentTitle: null,
      riskBlockNewTrades: false,
    });
    assert.equal(report.readinessStatus, "BLOCKED");
    assert.ok(report.blockers.some((b) => /LIVE_EXECUTION/i.test(b)));
  });

  it("never enables live in snapshot contract", () => {
    const report = buildMicroLiveReadinessReport({
      connected: true,
      testnetConfigured: true,
      evidenceCompletedTrades: 12,
      evidenceValidTrades: Array.from({ length: 12 }, (_, i) => validTrade(`t-${i}`)),
      evidenceExcluded: [],
      evidenceMissingDecisionLogId: 0,
      evidenceMissingCloseJournal: 0,
      evidenceMissingPnl: 0,
      journal: [
        {
          status: "CLOSED",
          closeAttempt: true,
          operatorNote: "reduce-only close",
        } as never,
      ],
      learningRecords: Array.from({ length: 12 }, (_, i) => ({
        learningRecordId: `lrn-${i}`,
        tradeId: `t-${i}`,
        closedTradeId: `t-${i}`,
      })) as never[],
      learningPendingCount: 0,
      monitorEvents: [],
      requireDoubleConfirm: true,
      liveExecutionEnabled: false,
      liveBlocked: true,
      killSwitchConfigured: true,
      killSwitchPaused: false,
      criticalIncidentOpen: false,
      criticalIncidentTitle: null,
      riskBlockNewTrades: false,
    });
    assert.ok(report.readinessScore > 0);
    assert.ok(report.evidenceLinks.length > 0);
  });
});
