import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { estimateOptionsGreeks } from "./estimate-greeks";
import { simulateExchangeAcceptReject } from "./simulate-exchange";
import { buildOptionsDryRunPerformanceReport } from "./build-performance-report";
import type { OptionsDryRunResult } from "./types";
import type { OptionsOrderPreview } from "@/lib/options-execution/types";

function basePreview(overrides: Partial<OptionsOrderPreview> = {}): OptionsOrderPreview {
  return {
    previewId: "p1",
    valid: true,
    previewOnly: true,
    realExecutionDisabled: true,
    ticket: {
      ticketId: "t1",
      decisionLogId: "dl1",
      instrument: "sell_call",
      optionsInstrument: {
        symbol: "BTC-TEST-C",
        base: "BTC",
        strike: 65000,
        expiry: "01JAN26",
        expiryTimeMs: Date.now() + 86400000,
        optionType: "call",
        bid: 100,
        ask: 105,
        markPrice: 102,
        spreadPct: 4.9,
        delta: 0.14,
        iv: 32,
        mapped: true,
        mappingErrors: [],
      },
      side: "short",
      contracts: 1,
      limitPrice: 102,
      notionalUsd: 102,
      positionSizePct: 1,
      stopLossIndex: 68000,
      takeProfitIndex: 90,
      generatedAt: new Date().toISOString(),
      sourceTicket: {
        id: "t1",
        decisionLogId: "dl1",
        instrument: "sell_call",
        symbol: "BTC-TEST-C",
        side: "short",
        entryPrice: 60000,
        positionSizePct: 1,
        stopLoss: 68000,
        takeProfit: 90,
        strike: 65000,
        entryOptionMark: 102,
      },
    },
    estimatedPremiumUsd: 102,
    estimatedMaxLossUsd: 500,
    estimatedBreakevenIndex: 65102,
    margin: {
      estimatedMarginUsd: 122,
      marginUsagePct: 5,
      availableBalanceUsd: 2000,
      sufficient: true,
    },
    expiryPlan: null,
    assignmentRisk: "test",
    settlementRisk: "test",
    liquidityRisk: "Mark/bid/ask within normal desk range.",
    slippageRisk: "test",
    riskChecks: [
      {
        id: "preview_only",
        label: "Preview",
        status: "PASS",
        message: "ok",
        blocking: false,
      },
    ],
    blockingReasons: [],
    warnings: [],
    bybitPayload: { symbol: "BTC-TEST-C", qty: "1" },
    disclaimer: "test",
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function dryRunResult(
  overrides: Partial<OptionsDryRunResult> = {},
): OptionsDryRunResult {
  const preview = basePreview();
  return {
    dryRunId: "odr-1",
    decisionLogId: "dl1",
    instrument: "BTC-TEST-C",
    side: "short",
    qty: 1,
    premium: 102,
    bidAskSpread: 4.9,
    estimatedMargin: 122,
    delta: 0.14,
    gamma: 0.001,
    theta: -0.02,
    vega: 0.5,
    riskStatus: "PASS",
    wouldSubmit: true,
    rejectionReasons: [],
    createdAt: new Date().toISOString(),
    preview,
    realTimeRisk: null,
    simulatedExchangeDecision: "ACCEPT",
    dryRunOnly: true,
    noRealOrders: true,
    cannotEnableLive: true,
    disclaimer: "test",
    rejectionCategory: null,
    ...overrides,
  };
}

const ENV_BACKUP: Record<string, string | undefined> = {};

function setEnv(key: string, value: string | undefined) {
  if (!(key in ENV_BACKUP)) ENV_BACKUP[key] = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function restoreEnv() {
  for (const [key, value] of Object.entries(ENV_BACKUP)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("options dry-run MVP 44", () => {
  beforeEach(() => {
    setEnv("OPTIONS_NAKED_ALLOWED", "true");
    setEnv("OPTIONS_LIVE_ENABLED", "false");
  });
  afterEach(() => restoreEnv());

  it("estimates greeks from instrument", () => {
    const g = estimateOptionsGreeks({
      instrument: basePreview().ticket!.optionsInstrument,
      spotPrice: 60000,
      hoursToExpiry: 48,
    });
    assert.ok(g.delta < 0);
    assert.ok(typeof g.gamma === "number");
    assert.ok(typeof g.vega === "number");
  });

  it("simulates ACCEPT when preview valid", () => {
    const sim = simulateExchangeAcceptReject({
      preview: basePreview(),
    });
    assert.equal(sim.decision, "ACCEPT");
    assert.equal(sim.wouldSubmit, true);
  });

  it("simulates REJECT on blocking preview", () => {
    const sim = simulateExchangeAcceptReject({
      preview: basePreview({
        valid: false,
        blockingReasons: ["Governance pause active."],
        riskChecks: [
          {
            id: "gov",
            label: "Governance",
            status: "FAIL",
            message: "Governance pause active.",
            blocking: true,
          },
        ],
      }),
    });
    assert.equal(sim.decision, "REJECT");
    assert.equal(sim.wouldSubmit, false);
    assert.equal(sim.rejectionCategory, "governance");
  });

  it("builds performance report with rejection buckets", () => {
    const report = buildOptionsDryRunPerformanceReport({
      history: [
        dryRunResult({ wouldSubmit: true }),
        dryRunResult({
          wouldSubmit: false,
          rejectionCategory: "liquidity",
          rejectionReasons: ["Wide spread"],
          simulatedExchangeDecision: "REJECT",
        }),
        dryRunResult({
          wouldSubmit: false,
          rejectionCategory: "risk_engine",
          rejectionReasons: ["Real-time risk BLOCKED"],
          simulatedExchangeDecision: "REJECT",
        }),
      ],
    });
    assert.equal(report.totalDryRuns, 3);
    assert.equal(report.wouldSubmitCount, 1);
    assert.equal(report.missedDueToLiquidity, 1);
    assert.equal(report.rejectedByRiskEngine, 1);
    assert.equal(report.cannotEnableLive, true);
  });

  it("readiness contribution requires minimum sample", () => {
    const report = buildOptionsDryRunPerformanceReport({
      history: [dryRunResult()],
    });
    assert.equal(report.readinessContribution.readyForLiveGate, false);
    assert.ok(report.readinessContribution.blockers.length > 0);
  });
});
