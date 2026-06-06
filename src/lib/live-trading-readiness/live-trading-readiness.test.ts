import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildLiveReadinessReport } from "@/lib/live-readiness/build-readiness-report";
import type { ServerReadinessContext } from "@/lib/live-readiness/types";
import { computeStrictPaperMetrics } from "@/lib/live-readiness/strict-paper-metrics";
import {
  buildStrategyHealthSignal,
  buildStrategyHealthSummary,
} from "@/lib/strategy-health";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import { buildLiveTradingPlanReport } from "./build-plan-report";
import { buildPaperValidationSnapshot } from "./paper-validation";
import { buildOperationalGates } from "./operational-gates";
import { OPTIONS_LIVE_HARD_BLOCK } from "./safety";

function serverContext(overrides?: Partial<ServerReadinessContext>): ServerReadinessContext {
  return {
    exchangeStatus: { configured: true, connected: true, network: "testnet" },
    liveExecution: {
      enabled: false,
      configured: true,
      network: "testnet",
      requireDoubleConfirm: true,
    },
    maxLiveNotionalUsd: 100,
    cronSecretConfigured: true,
    supabaseConfigured: true,
    telegramConfigured: true,
    discordEnvConfigured: false,
    deskWebhookConfigured: false,
    llmConfigured: false,
    serverAutomationAllowed: false,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function sampleEntry(overrides?: Partial<DecisionLogEntry>): DecisionLogEntry {
  return {
    id: "log-1",
    timestamp: new Date().toISOString(),
    btcPrice: 90000,
    marketRegime: "Range",
    agentOutputs: [],
    finalVerdict: "TRADE",
    riskVeto: false,
    topReasons: ["test"],
    actionPlan: "test",
    outcomeStatus: "RESOLVED",
    paperPnl: 1.2,
    reflection: null,
    isDemoData: false,
    ...overrides,
  };
}

function sampleOrder(overrides?: Partial<PaperOrder>): PaperOrder {
  return {
    id: "ord-1",
    instrument: "BTC sell_call",
    status: "CLOSED",
    openedAt: new Date().toISOString(),
    entryBtcPrice: 90000,
    sizePct: 1,
    committeeVerdict: "TRADE",
    decisionLogId: "log-1",
    paperMode: "STRICT_PAPER",
    realizedPnlPct: 1.2,
    isDemoData: false,
    ...overrides,
  } as PaperOrder;
}

describe("Live Trading Readiness Plan", () => {
  it("excludes demo data from strict paper metrics", () => {
    const metrics = computeStrictPaperMetrics(
      [sampleEntry(), sampleEntry({ id: "demo", isDemoData: true, paperPnl: 99 })],
      [sampleOrder(), sampleOrder({ id: "demo-o", isDemoData: true, realizedPnlPct: 99 })],
    );
    assert.equal(metrics.closedTrades, 1);
    assert.equal(metrics.resolvedTrades, 1);
    assert.ok(metrics.avgPnlPct < 50);
  });

  it("blocks live readiness without resolved paper trades", () => {
    const report = buildLiveReadinessReport({
      entries: [sampleEntry({ outcomeStatus: "PENDING", paperPnl: null })],
      orders: [sampleOrder({ status: "OPEN" })],
      riskProfile: "balanced",
      serverContext: serverContext(),
      killSwitchTested: true,
      auditEnabled: true,
    });
    assert.ok(
      report.hardBlockers.some((b) => b.includes("resolved paper")),
      `expected resolved blocker, got ${report.hardBlockers.join("; ")}`,
    );
  });

  it("reports paper validation linkage requirements", () => {
    const snap = buildPaperValidationSnapshot(
      [sampleEntry()],
      [sampleOrder({ decisionLogId: "log-1" })],
    );
    assert.equal(snap.linkedPaperTrades, 1);
    assert.equal(snap.unlinkedTrades, 0);
    assert.ok(snap.everyAnalyzeCreatesLog);
  });

  it("never allows options live in plan report", () => {
    const plan = buildLiveTradingPlanReport({
      readinessInput: {
        entries: [sampleEntry()],
        orders: [sampleOrder()],
        riskProfile: "balanced",
        serverContext: serverContext(),
        killSwitchTested: true,
        auditEnabled: true,
        commandCenterStatus: "SAFE",
        realTimeRiskStatus: "SAFE",
      },
      pilotMode: "LIVE_DISABLED",
    });
    assert.equal(plan.optionsLiveAllowed, false);
    assert.equal(plan.automaticLiveTrading, false);
    assert.ok(plan.safetyNotice.includes("disabled"));
  });

  it("flags operational blockers for untested kill switch", () => {
    const gates = buildOperationalGates({
      serverContext: serverContext(),
      killSwitchTested: false,
      auditEnabled: true,
    });
    assert.ok(gates.blockers.some((b) => b.includes("Kill switch")));
  });

  it("documents options live hard block message", () => {
    assert.ok(OPTIONS_LIVE_HARD_BLOCK.toLowerCase().includes("disabled"));
  });

  it("includes strategy health category in readiness", () => {
    const healthSignal = buildStrategyHealthSignal(
      buildStrategyHealthSummary({
        entries: [sampleEntry()],
        orders: [sampleOrder()],
      }),
    );
    const report = buildLiveReadinessReport({
      entries: [sampleEntry()],
      orders: [sampleOrder()],
      riskProfile: "balanced",
      strategyHealthSignal: healthSignal,
      serverContext: serverContext(),
      killSwitchTested: true,
      auditEnabled: true,
    });
    assert.ok(
      report.categories.some((c) => c.id === "strategy_health_readiness"),
    );
  });
});
