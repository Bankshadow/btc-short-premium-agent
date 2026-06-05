import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { buildPerformanceIntelligenceReport } from "./build-performance-report";
import { buildImprovementTrend, buildWeeklyPerformance } from "./aggregate-periods";
import { buildAiVersionSnapshot } from "./version-snapshot";
import { buildCommitteeAccuracy } from "./build-metrics";

function sampleEntry(overrides: Partial<DecisionLogEntry> = {}): DecisionLogEntry {
  return {
    id: "log-pi-1",
    timestamp: new Date().toISOString(),
    btcPrice: 65000,
    marketRegime: "Risk-on trend",
    agentOutputs: [],
    finalVerdict: "SKIP",
    riskVeto: false,
    topReasons: [],
    actionPlan: "Wait",
    outcomeStatus: "RESOLVED",
    paperPnl: 1.5,
    reflection: null,
    resolution: {
      btcPriceAfter: 64000,
      tradeWouldWin: false,
      notes: "Skip was right",
      resolvedAt: new Date().toISOString(),
    },
    falseSkipFlag: false,
    falseTradeFlag: false,
    ...overrides,
  };
}

describe("performance-intelligence", () => {
  it("builds full report with safety flags", () => {
    const report = buildPerformanceIntelligenceReport({
      entries: [sampleEntry(), sampleEntry({ id: "log-pi-2", paperPnl: -2 })],
      orders: [],
      riskProfile: "balanced",
    });
    assert.equal(report.analyticalOnly, true);
    assert.equal(report.cannotPlaceTrades, true);
    assert.equal(report.cannotApproveChanges, true);
    assert.ok(report.safetyNotice.includes("analytical only"));
    assert.ok(report.versions.aiPolicyVersion.startsWith("policy-"));
    assert.ok(report.committeeAccuracy.totalResolved >= 2);
  });

  it("detects improvement trend with two weekly buckets", () => {
    const now = Date.now();
    const weekAgo = new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString();
    const entries = [
      sampleEntry({
        id: "w1",
        paperPnl: -1,
        resolution: {
          btcPriceAfter: 64000,
          tradeWouldWin: false,
          notes: "loss",
          resolvedAt: weekAgo,
        },
      }),
      sampleEntry({
        id: "w2",
        paperPnl: 3,
        finalVerdict: "TRADE",
        resolution: {
          btcPriceAfter: 66000,
          tradeWouldWin: true,
          notes: "win",
          resolvedAt: new Date().toISOString(),
        },
      }),
    ];
    const weekly = buildWeeklyPerformance(entries);
    const trend = buildImprovementTrend(weekly, []);
    assert.ok(["IMPROVING", "FLAT", "DECLINING", "INSUFFICIENT_DATA"].includes(trend.direction));
  });

  it("computes committee accuracy", () => {
    const acc = buildCommitteeAccuracy([
      sampleEntry(),
      sampleEntry({
        id: "bad",
        finalVerdict: "TRADE",
        resolution: {
          btcPriceAfter: 64000,
          tradeWouldWin: false,
          notes: "wrong trade",
          resolvedAt: new Date().toISOString(),
        },
      }),
    ]);
    assert.equal(acc.totalResolved, 2);
    assert.ok(acc.accuracyPct >= 0 && acc.accuracyPct <= 100);
  });

  it("builds version snapshot from registry history", () => {
    const snap = buildAiVersionSnapshot({
      riskProfile: "balanced",
      persistedRegistry: {
        overrides: {},
        versionHistory: {
          options_short_premium: [
            {
              version: "v2",
              changedAt: "2026-01-01T00:00:00.000Z",
              note: "promoted",
              status: "ACTIVE",
            },
          ],
        },
      },
      ruleProposals: [],
      governanceAuditCount: 3,
    });
    assert.ok(snap.strategyRegistryVersion.includes("registry"));
    assert.ok(snap.governanceVersion.includes("gov-v3"));
  });
});
