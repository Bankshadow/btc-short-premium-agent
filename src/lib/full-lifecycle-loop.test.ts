import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { runAnalysis } from "@/lib/analysis/analysis-runner";
import type { BinanceTestnetClient } from "@/lib/execution/binance-testnet-client";
import type { BinanceTestnetStatus } from "@/lib/execution/binance-testnet-types";
import { createClosePreview } from "@/lib/execution/create-close-preview";
import { executeTestnetClose } from "@/lib/execution/execute-testnet-close";
import { executeTestnetOrder } from "@/lib/execution/execute-testnet-order";
import { getEvents } from "@/lib/journal/journal-query";
import { validateJournalChain } from "@/lib/journal/journal-chain-validator";
import { getReconciliationStatus } from "@/lib/positions/position-monitor";
import { runMirofishSwarm } from "@/lib/skills/mirofish-swarm/swarm-runner";

function connectedStatus(): BinanceTestnetStatus {
  return {
    status: "CONNECTED",
    testnetEnabled: true,
    liveEnabled: false,
    apiKeyPresent: true,
    apiSecretPresent: true,
    proxyEnabled: false,
    proxyUrlConfigured: false,
    baseUrl: "https://demo-fapi.binance.com",
    serverTimeOk: true,
    lastCheckedAt: new Date().toISOString(),
    reason: "ok",
    recommendation: "ok",
  };
}

function createLifecycleMockClient(): BinanceTestnetClient & { orderCalls: number } {
  const state = {
    orderCalls: 0,
    positions: [] as Array<{ symbol: string; positionAmt: string }>,
  };
  return {
    get orderCalls() {
      return state.orderCalls;
    },
    async getPositions() {
      return state.positions.map((p) => ({
        symbol: p.symbol,
        positionAmt: p.positionAmt,
        entryPrice: "50000",
        unrealizedProfit: "1.5",
        markPrice: "50100",
      }));
    },
    async createMarketOrder(input) {
      state.orderCalls += 1;
      if (input.reduceOnly) {
        state.positions = [];
      } else {
        state.positions = [{ symbol: input.symbol, positionAmt: "-0.001" }];
      }
      return {
        orderId: String(1000 + state.orderCalls),
        clientOrderId: input.clientOrderId ?? "lifecycle-mock",
        symbol: input.symbol,
        side: input.side,
        type: "MARKET",
        status: "FILLED",
        origQty: input.quantity,
        executedQty: input.quantity,
        avgPrice: input.reduceOnly ? "49000" : "50000",
        updateTime: Date.now(),
      };
    },
  } as unknown as BinanceTestnetClient & { orderCalls: number };
}

const LIFECYCLE_EVENT_TYPES = [
  "ANALYSIS_STARTED",
  "SCENARIO_CONTEXT_INJECTED",
  "RULE_ENGINE_EVALUATED",
  "VERDICT_CREATED",
  "PREVIEW_CREATED",
  "EXECUTION_REVIEWED",
  "ORDER_EXECUTED",
  "POSITION_OPENED",
  "POSITION_MONITORED",
  "CLOSE_PREVIEW_CREATED",
  "CLOSE_REVIEWED",
  "CLOSE_ORDER_EXECUTED",
  "POSITION_CLOSED",
  "PNL_REALIZED",
  "TRADE_RESULT_CLASSIFIED",
  "LEARNING_RECORD_CREATED",
  "EVIDENCE_PROGRESS_UPDATED",
  "STRATEGY_HEALTH_UPDATED",
  "AGENT_SCORE_UPDATED",
  "PORTFOLIO_RISK_EVALUATED",
  "SESSION_REPLAY_CREATED",
  "DAILY_BRIEFING_CREATED",
  "AUDIT_PACK_CREATED",
] as const;

describe("Full lifecycle loop", () => {
  let tmpDir: string;
  let prevDir: string | undefined;
  let prevMockTrade: string | undefined;
  let prevMockConn: string | undefined;
  let prevKill: string | undefined;
  let prevLive: string | undefined;
  let prevKey: string | undefined;
  let prevSecret: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v2-lifecycle-"));
    prevDir = process.env.JOURNAL_DATA_DIR;
    prevMockTrade = process.env.V2_MVP2_MOCK_TRADE;
    prevMockConn = process.env.BINANCE_TESTNET_MOCK_CONNECTED;
    prevKill = process.env.KILL_SWITCH_ACTIVE;
    prevLive = process.env.BINANCE_LIVE_ENABLED;
    prevKey = process.env.BINANCE_API_KEY;
    prevSecret = process.env.BINANCE_API_SECRET;

    process.env.JOURNAL_DATA_DIR = tmpDir;
    process.env.BINANCE_TESTNET_ENABLED = "true";
    process.env.BINANCE_TESTNET_MOCK_CONNECTED = "true";
    process.env.V2_MVP2_MOCK_TRADE = "true";
    process.env.KILL_SWITCH_ACTIVE = "false";
    process.env.BINANCE_LIVE_ENABLED = "false";
    process.env.BINANCE_API_KEY = "test-key";
    process.env.BINANCE_API_SECRET = "test-secret";
  });

  afterEach(() => {
    if (prevDir !== undefined) process.env.JOURNAL_DATA_DIR = prevDir;
    else delete process.env.JOURNAL_DATA_DIR;
    if (prevMockTrade !== undefined) process.env.V2_MVP2_MOCK_TRADE = prevMockTrade;
    else delete process.env.V2_MVP2_MOCK_TRADE;
    if (prevMockConn !== undefined) process.env.BINANCE_TESTNET_MOCK_CONNECTED = prevMockConn;
    else delete process.env.BINANCE_TESTNET_MOCK_CONNECTED;
    if (prevKill !== undefined) process.env.KILL_SWITCH_ACTIVE = prevKill;
    else delete process.env.KILL_SWITCH_ACTIVE;
    if (prevLive !== undefined) process.env.BINANCE_LIVE_ENABLED = prevLive;
    else delete process.env.BINANCE_LIVE_ENABLED;
    if (prevKey !== undefined) process.env.BINANCE_API_KEY = prevKey;
    else delete process.env.BINANCE_API_KEY;
    if (prevSecret !== undefined) process.env.BINANCE_API_SECRET = prevSecret;
    else delete process.env.BINANCE_API_SECRET;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("chains Start AI through briefing/audit via journal loop", async () => {
    await runMirofishSwarm();

    const analysis = await runAnalysis();
    assert.ok(analysis.runId);
    assert.ok(analysis.decisionLogId);
    assert.ok(analysis.previewId, "TRADE verdict should create preview");

    let events = await getEvents();
    assert.ok(events.some((e) => e.type === "ANALYSIS_STARTED"));
    assert.ok(events.some((e) => e.type === "SCENARIO_CONTEXT_INJECTED"));
    assert.ok(events.some((e) => e.type === "RULE_ENGINE_EVALUATED"));
    assert.ok(events.some((e) => e.type === "VERDICT_CREATED"));
    assert.ok(events.some((e) => e.type === "PREVIEW_CREATED"));

    const client = createLifecycleMockClient();
    const exec = await executeTestnetOrder({
      previewId: analysis.previewId!,
      doubleConfirm: true,
      client,
      getBinanceStatus: async () => connectedStatus(),
    });
    assert.equal(exec.ok, true);
    assert.ok(exec.tradeId);

    events = await getEvents();
    assert.ok(events.some((e) => e.type === "EXECUTION_REVIEWED"));
    assert.ok(events.some((e) => e.type === "ORDER_EXECUTED"));
    assert.ok(events.some((e) => e.type === "POSITION_OPENED"));
    assert.ok(
      events.some((e) => e.type === "POSITION_MONITORED" && e.tradeId === exec.tradeId),
      "position monitor should run automatically after execute",
    );

    const reconciliation = await getReconciliationStatus();
    assert.ok(reconciliation.status === "OK" || reconciliation.status === "WARNING");

    const closePreview = await createClosePreview({ tradeId: exec.tradeId! });
    assert.equal(closePreview.ok, true);

    const close = await executeTestnetClose({
      closePreviewId: closePreview.preview!.closePreviewId,
      doubleConfirm: true,
      client,
      getBinanceStatus: async () => connectedStatus(),
    });
    assert.equal(close.ok, true);
    assert.equal(close.positionClosed, true);

    events = await getEvents();
    for (const type of LIFECYCLE_EVENT_TYPES) {
      assert.ok(
        events.some((e) => e.type === type),
        `missing lifecycle event: ${type}`,
      );
    }

    const warnings = validateJournalChain(events);
    const critical = warnings.filter((w) =>
      ["POSITION_CLOSED_WITHOUT_ORDER", "PNL_WITHOUT_CLOSE"].includes(w.code),
    );
    assert.equal(critical.length, 0, critical.map((w) => w.message).join("; "));
  });
});
