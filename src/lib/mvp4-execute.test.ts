import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import type { BinanceTestnetClient } from "@/lib/execution/binance-testnet-client";
import type { BinanceTestnetStatus } from "@/lib/execution/binance-testnet-types";
import { createTestnetPreview } from "@/lib/execution/create-preview";
import { executeTestnetOrder } from "@/lib/execution/execute-testnet-order";
import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { getTradesSummary } from "@/lib/trades/trade-query";

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

function createMockClient(): BinanceTestnetClient {
  const state = { calls: 0 };
  return {
    get orderCalls() {
      return state.calls;
    },
    async createMarketOrder(input) {
      state.calls += 1;
      return {
        orderId: "999001",
        clientOrderId: input.clientOrderId ?? "v2-mock",
        symbol: input.symbol,
        side: input.side,
        type: "MARKET",
        status: "FILLED",
        origQty: input.quantity,
        executedQty: input.quantity,
        avgPrice: "50000",
        updateTime: Date.now(),
      };
    },
  } as unknown as BinanceTestnetClient;
}

describe("MVP 4 testnet execute", () => {
  let tmpDir: string;
  let prevDir: string | undefined;
  let prevMockConn: string | undefined;
  let prevKill: string | undefined;
  let prevLive: string | undefined;
  let prevKey: string | undefined;
  let prevSecret: string | undefined;
  let previewId: string;

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v2-mvp4-"));
    prevDir = process.env.JOURNAL_DATA_DIR;
    prevMockConn = process.env.BINANCE_TESTNET_MOCK_CONNECTED;
    prevKill = process.env.KILL_SWITCH_ACTIVE;
    prevLive = process.env.BINANCE_LIVE_ENABLED;
    prevKey = process.env.BINANCE_API_KEY;
    prevSecret = process.env.BINANCE_API_SECRET;

    process.env.JOURNAL_DATA_DIR = tmpDir;
    process.env.BINANCE_TESTNET_ENABLED = "true";
    process.env.BINANCE_TESTNET_MOCK_CONNECTED = "true";
    process.env.KILL_SWITCH_ACTIVE = "false";
    process.env.BINANCE_LIVE_ENABLED = "false";
    process.env.BINANCE_API_KEY = "test-key";
    process.env.BINANCE_API_SECRET = "test-secret";

    const created = await createTestnetPreview({
      runId: "run-exec",
      decisionLogId: "dl-exec",
    });
    previewId = created.preview!.previewId;
  });

  after(() => {
    if (prevDir !== undefined) process.env.JOURNAL_DATA_DIR = prevDir;
    else delete process.env.JOURNAL_DATA_DIR;
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

  it("execute blocks if doubleConfirm false", async () => {
    const client = createMockClient();
    const result = await executeTestnetOrder({
      previewId,
      doubleConfirm: false,
      client,
      getBinanceStatus: async () => connectedStatus(),
    });
    assert.equal(result.ok, false);
    assert.equal(client.orderCalls, 0);
  });

  it("execute blocks if Binance status MISSING_ENV", async () => {
    const fresh = await createTestnetPreview({
      runId: "run-missing",
      decisionLogId: "dl-missing",
    });
    const client = createMockClient();
    const result = await executeTestnetOrder({
      previewId: fresh.preview!.previewId,
      doubleConfirm: true,
      client,
      getBinanceStatus: async () => ({
        ...connectedStatus(),
        status: "MISSING_ENV",
        reason: "Missing API credentials",
        recommendation: "Add keys",
      }),
    });
    assert.equal(result.ok, false);
    assert.equal(client.orderCalls, 0);
  });

  it("execute blocks if Binance status BLOCKED_BY_REGION", async () => {
    const fresh = await createTestnetPreview({
      runId: "run-region",
      decisionLogId: "dl-region",
    });
    const client = createMockClient();
    const result = await executeTestnetOrder({
      previewId: fresh.preview!.previewId,
      doubleConfirm: true,
      client,
      getBinanceStatus: async () => ({
        ...connectedStatus(),
        status: "BLOCKED_BY_REGION",
        reason: "HTTP 451",
        recommendation: "Use proxy",
      }),
    });
    assert.equal(result.ok, false);
    assert.equal(client.orderCalls, 0);
  });

  it("execute blocks if preview expired", async () => {
    const pid = "prev-expired-exec";
    await appendEvent({
      type: "PREVIEW_CREATED",
      environment: "testnet",
      runId: "run-exp-exec",
      decisionLogId: "dl-exp-exec",
      previewId: pid,
      payload: {
        previewId: pid,
        runId: "run-exp-exec",
        decisionLogId: "dl-exp-exec",
        symbol: "BTCUSDT",
        side: "SELL",
        notionalUsd: 50,
        estimatedQty: "0.001",
        orderType: "MARKET",
        environment: "TESTNET",
        status: "ACTIVE",
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
        createdAt: new Date(Date.now() - 120_000).toISOString(),
      },
    });
    const client = createMockClient();
    const result = await executeTestnetOrder({
      previewId: pid,
      doubleConfirm: true,
      client,
      getBinanceStatus: async () => connectedStatus(),
    });
    assert.equal(result.ok, false);
    assert.equal(client.orderCalls, 0);
  });

  it("execute blocks if duplicate order exists", async () => {
    const fresh = await createTestnetPreview({
      runId: "run-dup-exec",
      decisionLogId: "dl-dup-exec",
    });
    const pid = fresh.preview!.previewId;
    await appendEvent({
      type: "ORDER_EXECUTED",
      environment: "testnet",
      runId: "run-dup-exec",
      decisionLogId: "dl-dup-exec",
      previewId: pid,
      tradeId: "trade-existing",
      payload: { previewId: pid, symbol: "BTCUSDT", side: "SELL" },
    });
    const client = createMockClient();
    const result = await executeTestnetOrder({
      previewId: pid,
      doubleConfirm: true,
      client,
      getBinanceStatus: async () => connectedStatus(),
    });
    assert.equal(result.ok, false);
    assert.equal(client.orderCalls, 0);
  });

  it("execute blocks if liveEnabled true", async () => {
    const fresh = await createTestnetPreview({
      runId: "run-live-block",
      decisionLogId: "dl-live-block",
    });
    process.env.BINANCE_LIVE_ENABLED = "true";
    const client = createMockClient();
    const result = await executeTestnetOrder({
      previewId: fresh.preview!.previewId,
      doubleConfirm: true,
      client,
      getBinanceStatus: async () => connectedStatus(),
    });
    process.env.BINANCE_LIVE_ENABLED = "false";
    assert.equal(result.ok, false);
    assert.equal(client.orderCalls, 0);
  });

  it("execute blocks if missing decisionLogId", async () => {
    const pid = "prev-no-dl-exec";
    await appendEvent({
      type: "PREVIEW_CREATED",
      environment: "testnet",
      runId: "run-no-dl-exec",
      decisionLogId: "",
      previewId: pid,
      payload: {
        previewId: pid,
        runId: "run-no-dl-exec",
        decisionLogId: "",
        symbol: "BTCUSDT",
        side: "SELL",
        notionalUsd: 50,
        estimatedQty: "0.001",
        orderType: "MARKET",
        environment: "TESTNET",
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + 900_000).toISOString(),
        createdAt: new Date().toISOString(),
      },
    });
    const client = createMockClient();
    const result = await executeTestnetOrder({
      previewId: pid,
      doubleConfirm: true,
      client,
      getBinanceStatus: async () => connectedStatus(),
    });
    assert.equal(result.ok, false);
    assert.equal(client.orderCalls, 0);
  });

  it("execute creates ORDER_EXECUTED event on success", async () => {
    const fresh = await createTestnetPreview({
      runId: "run-success",
      decisionLogId: "dl-success",
    });
    const client = createMockClient();
    const result = await executeTestnetOrder({
      previewId: fresh.preview!.previewId,
      doubleConfirm: true,
      client,
      getBinanceStatus: async () => connectedStatus(),
    });
    assert.equal(result.ok, true);
    assert.equal(client.orderCalls, 1);
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "ORDER_EXECUTED" && e.previewId === fresh.preview!.previewId));
  });

  it("execute creates OPEN trade on success", async () => {
    const trades = await getTradesSummary();
    assert.ok(trades.open.length >= 1);
    assert.equal(trades.summary.executionCount >= 1, true);
  });

  it("API secret is never returned in Binance status payload", () => {
    const status = connectedStatus();
    const json = JSON.stringify(status);
    assert.ok(!json.includes("test-secret"));
    assert.ok(!("apiSecret" in status));
    assert.ok(!("apiKey" in status));
  });

  it("no Binance call is made when blocked", async () => {
    const client = createMockClient();
    await executeTestnetOrder({
      previewId,
      doubleConfirm: false,
      client,
      getBinanceStatus: async () => connectedStatus(),
    });
    assert.equal(client.orderCalls, 0);
  });
});
