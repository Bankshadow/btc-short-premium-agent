import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import type { OrderTicket } from "@/lib/trade-control/trade-control-types";
import type { OptionCandidate } from "@/lib/types/market";
import { mapPlaybookToOptionsInstrument } from "./map-instrument";
import { blockLiveOptionsAttempt, loadOptionsExecutionConfig } from "./config";
import { runOptionsRiskChecks, summarizeRiskChecks } from "./risk-checks";
import { simulateTestnetOptionsOrder } from "./testnet-order";
import type { OptionsOrderPreview } from "./types";
import { evaluateKillSwitch } from "@/lib/validation/kill-switch";

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

function sampleTicket(): OrderTicket {
  return {
    id: "ticket-test",
    decisionLogId: "log-1",
    generatedAt: new Date().toISOString(),
    strategy: "Options Short Premium",
    strategyId: "options_short_premium",
    symbol: "BTC-27JUN26-95000-C",
    side: "short",
    instrument: "sell_call",
    entryPrice: 94000,
    entryOptionMark: 1200,
    strike: 95000,
    stopLoss: 96000,
    takeProfit: null,
    positionSizePct: 1.75,
    maxRiskPct: 1.75,
    invalidation: "test",
    forcedExit: "13:30 pin",
    confidence: 70,
    confidenceLevel: "MEDIUM",
    topReasons: ["IV ok"],
  };
}

function sampleCandidate(): OptionCandidate {
  return {
    symbol: "BTC-27JUN26-95000-C",
    strike: 95000,
    expiry: "2026-06-27",
    optionType: "call",
    markPrice: 1200,
    bid: 1180,
    ask: 1220,
    impliedVolatility: 45,
    delta: 0.14,
    theta: -1,
    premiumUsd: 1200,
    annualizedYieldPct: 12,
    otmPct: 1,
    sdDistance: 1.2,
  };
}

function minimalPreview(overrides: Partial<OptionsOrderPreview> = {}): OptionsOrderPreview {
  return {
    previewId: "p1",
    valid: true,
    previewOnly: true,
    realExecutionDisabled: true,
    ticket: null,
    estimatedPremiumUsd: 100,
    estimatedMaxLossUsd: 500,
    estimatedBreakevenIndex: 96000,
    margin: {
      estimatedMarginUsd: 120,
      marginUsagePct: 10,
      availableBalanceUsd: 1000,
      sufficient: true,
    },
    expiryPlan: null,
    assignmentRisk: "",
    settlementRisk: "",
    liquidityRisk: "",
    slippageRisk: "",
    riskChecks: [],
    blockingReasons: [],
    warnings: [],
    bybitPayload: null,
    disclaimer: "test",
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("options execution MVP 27", () => {
  beforeEach(() => {
    setEnv("OPTIONS_LIVE_ENABLED", "false");
    setEnv("OPTIONS_TESTNET_ENABLED", "false");
    setEnv("OPTIONS_NAKED_ALLOWED", "false");
    setEnv("OPTIONS_MAX_NOTIONAL_USD", "500");
  });

  afterEach(() => {
    restoreEnv();
  });

  it("cannot place real BTC options live order when OPTIONS_LIVE_ENABLED", () => {
    setEnv("OPTIONS_LIVE_ENABLED", "true");
    const block = blockLiveOptionsAttempt();
    assert.ok(block);
    assert.match(block!, /not implemented/i);
  });

  it("blocks OPTIONS_LIVE_ENABLED on testnet-order simulation", () => {
    setEnv("OPTIONS_LIVE_ENABLED", "true");
    const result = simulateTestnetOptionsOrder(minimalPreview(), []);
    assert.equal(result.ok, false);
    assert.equal(result.realOrderSent, false);
    assert.ok(result.error?.includes("not implemented"));
  });

  it("generates preview mapping from playbook ticket and candidate", () => {
    const future = new Date();
    future.setUTCMonth(future.getUTCMonth() + 2);
    const day = future.getUTCDate();
    const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
    const code = `${day}${months[future.getUTCMonth()]}${String(future.getUTCFullYear()).slice(-2)}`;
    const symbol = `BTC-${code}-95000-C`;
    const ticket = { ...sampleTicket(), symbol };
    const candidate = { ...sampleCandidate(), symbol };

    const { instrument, errors } = mapPlaybookToOptionsInstrument(ticket, candidate);
    assert.ok(instrument);
    assert.equal(instrument!.symbol, symbol);
    assert.equal(errors.length, 0);
  });

  it("blocks illiquid or unmapped instrument", () => {
    const ticket = sampleTicket();
    const badCandidate = {
      ...sampleCandidate(),
      bid: 0,
      ask: 0,
      markPrice: 0,
    };
    const { errors } = mapPlaybookToOptionsInstrument(ticket, badCandidate);
    assert.ok(errors.length > 0);
    assert.ok(errors.some((e) => e.includes("bid/ask") || e.includes("mark")));
  });

  it("blocks when margin estimate exceeds cap", () => {
    setEnv("OPTIONS_MAX_MARGIN_PCT", "5");
    setEnv("OPTIONS_NAKED_ALLOWED", "true");
    const checks = runOptionsRiskChecks({
      ticket: {
        ticketId: "t",
        decisionLogId: "l",
        instrument: "sell_call",
        optionsInstrument: {
          symbol: "BTC-27JUN26-95000-C",
          base: "BTC",
          strike: 95000,
          expiry: "2026-06-27",
          expiryTimeMs: Date.now() + 86400000 * 30,
          optionType: "call",
          bid: 100,
          ask: 110,
          markPrice: 105,
          spreadPct: 5,
          delta: 0.14,
          iv: 40,
          mapped: true,
          mappingErrors: [],
        },
        side: "short",
        contracts: 1,
        limitPrice: 105,
        notionalUsd: 100,
        positionSizePct: 1,
        stopLossIndex: 96000,
        takeProfitIndex: null,
        generatedAt: new Date().toISOString(),
        sourceTicket: sampleTicket(),
      },
      instrument: {
        symbol: "BTC-27JUN26-95000-C",
        base: "BTC",
        strike: 95000,
        expiry: "2026-06-27",
        expiryTimeMs: Date.now() + 86400000 * 30,
        optionType: "call",
        bid: 100,
        ask: 110,
        markPrice: 105,
        spreadPct: 5,
        delta: 0.14,
        iv: 40,
        mapped: true,
        mappingErrors: [],
      },
      margin: {
        estimatedMarginUsd: 700,
        marginUsagePct: 70,
        availableBalanceUsd: 1000,
        sufficient: false,
      },
    });
    const summary = summarizeRiskChecks(checks);
    assert.ok(
      checks.some((c) => c.id === "max_margin" && c.blocking),
    );
  });

  it("blocks when kill switch active via risk checks", () => {
    setEnv("OPTIONS_NAKED_ALLOWED", "true");
    const entries = Array.from({ length: 4 }, (_, i) => ({
      id: `e-${i}`,
      timestamp: new Date().toISOString(),
      outcomeStatus: "RESOLVED" as const,
      paperPnl: -2,
      deskRiskProfile: "balanced" as const,
    }));

    const kill = evaluateKillSwitch({ entries, orders: [], riskProfile: "balanced" });
    assert.equal(kill.tradingPaused, true);

    const checks = runOptionsRiskChecks({
      ticket: null,
      instrument: null,
      margin: {
        estimatedMarginUsd: 0,
        marginUsagePct: null,
        availableBalanceUsd: null,
        sufficient: null,
      },
      entries,
      orders: [],
    });
    assert.ok(checks.some((c) => c.id === "kill_switch" && c.blocking));
  });

  it("testnet order requires OPTIONS_TESTNET_ENABLED", () => {
    const config = loadOptionsExecutionConfig();
    assert.equal(config.testnetEnabled, false);
    const result = simulateTestnetOptionsOrder(minimalPreview({ valid: true }), []);
    assert.equal(result.ok, false);
    assert.match(result.error!, /OPTIONS_TESTNET_ENABLED/);
  });
});
