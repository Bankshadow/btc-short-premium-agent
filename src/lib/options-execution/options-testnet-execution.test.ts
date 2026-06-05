import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  assertOptionsTestnetExecutionAllowed,
  blockProductionOptionsOrder,
  PRODUCTION_OPTIONS_HARD_ERROR,
} from "./testnet-gates";
import { reconcileOptionsTestnetState } from "./reconcile-testnet-state";
import { placeOptionsTestnetOrder } from "./options-testnet-execution";
import type { OptionsOrderPreview, OptionsTestnetJournalEntry } from "./types";

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

function minimalPreview(overrides: Partial<OptionsOrderPreview> = {}): OptionsOrderPreview {
  return {
    previewId: "p1",
    valid: true,
    previewOnly: true,
    realExecutionDisabled: true,
    ticket: {
      ticketId: "t1",
      decisionLogId: "log-1",
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
      notionalUsd: 105,
      positionSizePct: 1,
      stopLossIndex: 96000,
      takeProfitIndex: null,
      generatedAt: new Date().toISOString(),
      sourceTicket: {
        id: "ticket-test",
        decisionLogId: "log-1",
        generatedAt: new Date().toISOString(),
        strategy: "Options Short Premium",
        strategyId: "options_short_premium",
        symbol: "BTC-27JUN26-95000-C",
        side: "short",
        instrument: "sell_call",
        entryPrice: 94000,
        entryOptionMark: 105,
        strike: 95000,
        stopLoss: 96000,
        takeProfit: null,
        positionSizePct: 1,
        maxRiskPct: 1,
        invalidation: "test",
        forcedExit: "13:30 pin",
        confidence: 70,
        confidenceLevel: "MEDIUM",
        topReasons: ["IV ok"],
      },
    },
    estimatedPremiumUsd: 105,
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
    bybitPayload: {
      category: "option",
      symbol: "BTC-27JUN26-95000-C",
      side: "Sell",
      orderType: "Limit",
      qty: "1",
      price: "105",
      timeInForce: "GTC",
      reduceOnly: false,
    },
    disclaimer: "test",
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("options testnet execution MVP 39", () => {
  beforeEach(() => {
    setEnv("OPTIONS_LIVE_ENABLED", "false");
    setEnv("OPTIONS_TESTNET_ENABLED", "false");
    setEnv("BYBIT_TESTNET", "false");
    setEnv("BYBIT_API_KEY", undefined);
    setEnv("BYBIT_API_SECRET", undefined);
    setEnv("OPTIONS_NAKED_ALLOWED", "true");
  });

  afterEach(() => {
    restoreEnv();
  });

  it("blocks production when OPTIONS_LIVE_ENABLED is true", () => {
    setEnv("OPTIONS_LIVE_ENABLED", "true");
    const block = blockProductionOptionsOrder();
    assert.ok(block);
    assert.match(block!, /not implemented/i);
  });

  it("requires BYBIT_TESTNET for testnet execution", () => {
    setEnv("OPTIONS_TESTNET_ENABLED", "true");
    setEnv("BYBIT_TESTNET", "false");
    const gate = assertOptionsTestnetExecutionAllowed();
    assert.equal(gate.allowed, false);
    assert.ok(gate.blockers.some((b) => b.includes("BYBIT_TESTNET")));
  });

  it("requires OPTIONS_TESTNET_ENABLED", () => {
    setEnv("BYBIT_TESTNET", "true");
    setEnv("BYBIT_API_KEY", "k");
    setEnv("BYBIT_API_SECRET", "s");
    const gate = assertOptionsTestnetExecutionAllowed();
    assert.equal(gate.allowed, false);
    assert.ok(gate.blockers.some((b) => b.includes("OPTIONS_TESTNET_ENABLED")));
  });

  it("blocks mainnet credentials for production options", () => {
    setEnv("BYBIT_TESTNET", "false");
    setEnv("BYBIT_API_KEY", "k");
    setEnv("BYBIT_API_SECRET", "s");
    const block = blockProductionOptionsOrder();
    assert.equal(block, PRODUCTION_OPTIONS_HARD_ERROR);
  });

  it("placeOptionsTestnetOrder journals blocked attempt without gates", async () => {
    const result = await placeOptionsTestnetOrder({
      preview: minimalPreview(),
      operatorApproval: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.testnetOnly, true);
    assert.equal(result.journalEntry.status, "BLOCKED");
    assert.ok(result.journalEntry.optionsTestnetTradeId.startsWith("opt-tn-"));
  });

  it("placeOptionsTestnetOrder requires operator approval", async () => {
    setEnv("OPTIONS_TESTNET_ENABLED", "true");
    setEnv("BYBIT_TESTNET", "true");
    setEnv("BYBIT_API_KEY", "k");
    setEnv("BYBIT_API_SECRET", "s");

    const result = await placeOptionsTestnetOrder({
      preview: minimalPreview(),
      operatorApproval: false,
    });
    assert.equal(result.ok, false);
    assert.match(result.error!, /operatorApproval/);
  });

  it("reconcile marks CLOSING as CLOSED when position gone", () => {
    const journal: OptionsTestnetJournalEntry[] = [
      {
        optionsTestnetTradeId: "opt-tn-1",
        decisionLogId: "l1",
        previewId: "p1",
        instrument: "sell_call",
        side: "short",
        qty: 1,
        premium: 100,
        marginEstimateUsd: 120,
        status: "CLOSING",
        exchangeOrderId: "ex-1",
        symbol: "BTC-27JUN26-95000-C",
        createdAt: new Date().toISOString(),
        executedAt: new Date().toISOString(),
        closedAt: null,
        operatorNote: null,
        error: null,
      },
    ];

    const report = reconcileOptionsTestnetState({
      journal,
      positions: [],
      orders: [],
    });
    assert.equal(report.updatedEntries[0].status, "CLOSED");
    assert.ok(report.updatedEntries[0].closedAt);
  });

  it("reconcile marks journal OPEN when exchange has position", () => {
    const journal: OptionsTestnetJournalEntry[] = [
      {
        optionsTestnetTradeId: "opt-tn-2",
        decisionLogId: "l1",
        previewId: "p1",
        instrument: "sell_call",
        side: "short",
        qty: 1,
        premium: 100,
        marginEstimateUsd: 120,
        status: "SUBMITTED",
        exchangeOrderId: "ex-2",
        symbol: "BTC-27JUN26-95000-C",
        createdAt: new Date().toISOString(),
        executedAt: new Date().toISOString(),
        closedAt: null,
        operatorNote: null,
        error: null,
      },
    ];

    const report = reconcileOptionsTestnetState({
      journal,
      positions: [
        {
          category: "option",
          symbol: "BTC-27JUN26-95000-C",
          side: "Sell",
          size: 1,
          avgPrice: 105,
          markPrice: 100,
          unrealisedPnl: 5,
          leverage: 1,
          positionValueUsd: 100,
          liqPrice: null,
        },
      ],
      orders: [],
    });
    assert.equal(report.updatedEntries[0].status, "OPEN");
  });
});
