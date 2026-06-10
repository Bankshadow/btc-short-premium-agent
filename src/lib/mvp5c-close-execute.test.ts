import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { BinanceTestnetClient } from "@/lib/execution/binance-testnet-client";
import type { BinanceTestnetStatus } from "@/lib/execution/binance-testnet-types";
import { createClosePreview } from "@/lib/execution/create-close-preview";
import { executeTestnetClose } from "@/lib/execution/execute-testnet-close";
import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { newClosePreviewId, newPositionId } from "@/lib/journal/journal-types";
import { refreshOpenPositions } from "@/lib/positions/position-monitor";
import { buildOpenTradesFromEvents } from "@/lib/trades/trade-store";
import { isLiveEnabled } from "@/lib/risk/risk-gate";
import { getBinanceTestnetStatus } from "@/lib/execution/binance-testnet-status";

const TRADE_ID = "trade-mvp5c-test";
const PREVIEW_ID = "prev-mvp5c-test";
const RUN_ID = "run-mvp5c";
const DL_ID = "dl-mvp5c";

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

function disconnectedStatus(): BinanceTestnetStatus {
  return {
    ...connectedStatus(),
    status: "DISCONNECTED",
    reason: "Disconnected",
    recommendation: "Check connection",
  };
}

function createMockClient(options?: {
  positions?: Array<{ symbol: string; positionAmt: string }>;
  closePositionsAfterOrder?: boolean;
  partialAfterOrderAmt?: string;
}): BinanceTestnetClient & { orderCalls: number; lastOrder?: { reduceOnly?: boolean } } {
  const state = {
    orderCalls: 0,
    positions: options?.positions ?? [],
    lastOrder: undefined as { reduceOnly?: boolean } | undefined,
  };
  return {
    get orderCalls() {
      return state.orderCalls;
    },
    get lastOrder() {
      return state.lastOrder;
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
      state.lastOrder = { reduceOnly: input.reduceOnly };
      assert.equal(input.reduceOnly, true, "close order must be reduceOnly");
      if (options?.partialAfterOrderAmt && state.positions.length > 0) {
        state.positions[0].positionAmt = options.partialAfterOrderAmt;
      } else if (options?.closePositionsAfterOrder) {
        state.positions = [];
      }
      return {
        orderId: "close-001",
        clientOrderId: input.clientOrderId ?? "v2-close-mock",
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
  } as unknown as BinanceTestnetClient & { orderCalls: number; lastOrder?: { reduceOnly?: boolean } };
}

async function seedOpenTrade() {
  await appendEvent({
    type: "ORDER_EXECUTED",
    environment: "testnet",
    runId: RUN_ID,
    decisionLogId: DL_ID,
    previewId: PREVIEW_ID,
    tradeId: TRADE_ID,
    payload: {
      symbol: "BTCUSDT",
      side: "SELL",
      qty: "0.001",
      orderId: "ord-001",
      notionalUsd: 50,
      previewId: PREVIEW_ID,
    },
  });
  await appendEvent({
    type: "POSITION_OPENED",
    environment: "testnet",
    runId: RUN_ID,
    decisionLogId: DL_ID,
    previewId: PREVIEW_ID,
    tradeId: TRADE_ID,
    payload: {
      symbol: "BTCUSDT",
      side: "SELL",
      qty: "0.001",
      orderId: "ord-001",
      entryPrice: 50000,
    },
  });
}

async function seedMonitoredOpenPosition(client?: BinanceTestnetClient) {
  await seedOpenTrade();
  await refreshOpenPositions({
    client:
      client ??
      createMockClient({
        positions: [{ symbol: "BTCUSDT", positionAmt: "-0.001" }],
      }),
    getBinanceStatus: async () => connectedStatus(),
  });
}

async function seedClosePreview(active = true, reduceOnly = true) {
  const closePreviewId = newClosePreviewId();
  const positionId = newPositionId();
  await appendEvent({
    type: "CLOSE_PREVIEW_CREATED",
    environment: "testnet",
    runId: RUN_ID,
    decisionLogId: DL_ID,
    previewId: PREVIEW_ID,
    tradeId: TRADE_ID,
    positionId,
    closePreviewId,
    payload: {
      closePreviewId,
      tradeId: TRADE_ID,
      positionId,
      runId: RUN_ID,
      decisionLogId: DL_ID,
      symbol: "BTCUSDT",
      sideToClose: "BUY",
      qty: "0.001",
      orderType: "MARKET",
      reduceOnly,
      environment: "TESTNET",
      expiresAt: active
        ? new Date(Date.now() + 900_000).toISOString()
        : new Date(Date.now() - 60_000).toISOString(),
      createdAt: new Date().toISOString(),
      blocked: false,
      blockReasons: [],
      requiresDoubleConfirm: true,
      status: "ACTIVE",
    },
  });
  return closePreviewId;
}

describe("MVP 5C reduce-only close execution", () => {
  let tmpDir: string;
  let prevDir: string | undefined;
  let prevLive: string | undefined;
  let prevMockConn: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v2-mvp5c-"));
    prevDir = process.env.JOURNAL_DATA_DIR;
    prevLive = process.env.BINANCE_LIVE_ENABLED;
    prevMockConn = process.env.BINANCE_TESTNET_MOCK_CONNECTED;
    process.env.JOURNAL_DATA_DIR = tmpDir;
    process.env.BINANCE_TESTNET_ENABLED = "true";
    process.env.BINANCE_LIVE_ENABLED = "false";
    process.env.BINANCE_TESTNET_MOCK_CONNECTED = "true";
    process.env.BINANCE_API_KEY = "test-key";
    process.env.BINANCE_API_SECRET = "test-secret";
  });

  afterEach(() => {
    if (prevDir !== undefined) process.env.JOURNAL_DATA_DIR = prevDir;
    else delete process.env.JOURNAL_DATA_DIR;
    if (prevLive !== undefined) process.env.BINANCE_LIVE_ENABLED = prevLive;
    else delete process.env.BINANCE_LIVE_ENABLED;
    if (prevMockConn !== undefined) process.env.BINANCE_TESTNET_MOCK_CONNECTED = prevMockConn;
    else delete process.env.BINANCE_TESTNET_MOCK_CONNECTED;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("close blocks without doubleConfirm", async () => {
    await seedMonitoredOpenPosition();
    const created = await createClosePreview({ tradeId: TRADE_ID });
    const client = createMockClient({ closePositionsAfterOrder: true });
    const result = await executeTestnetClose({
      closePreviewId: created.preview!.closePreviewId,
      doubleConfirm: false,
      client,
      getBinanceStatus: async () => connectedStatus(),
    });
    assert.equal(result.ok, false);
    assert.equal(client.orderCalls, 0);
  });

  it("close blocks if close preview expired", async () => {
    await seedMonitoredOpenPosition();
    const closePreviewId = await seedClosePreview(false);
    const client = createMockClient({ closePositionsAfterOrder: true });
    const result = await executeTestnetClose({
      closePreviewId,
      doubleConfirm: true,
      client,
      getBinanceStatus: async () => connectedStatus(),
    });
    assert.equal(result.ok, false);
    assert.equal(client.orderCalls, 0);
  });

  it("close blocks if reduceOnly false", async () => {
    await seedMonitoredOpenPosition();
    const closePreviewId = await seedClosePreview(true, false);
    const client = createMockClient({ closePositionsAfterOrder: true });
    const result = await executeTestnetClose({
      closePreviewId,
      doubleConfirm: true,
      client,
      getBinanceStatus: async () => connectedStatus(),
    });
    assert.equal(result.ok, false);
    assert.equal(client.orderCalls, 0);
  });

  it("close blocks if position UNKNOWN", async () => {
    await seedOpenTrade();
    const positionId = newPositionId();
    await appendEvent({
      type: "POSITION_MONITORED",
      environment: "testnet",
      runId: RUN_ID,
      decisionLogId: DL_ID,
      previewId: PREVIEW_ID,
      tradeId: TRADE_ID,
      positionId,
      payload: {
        tradeId: TRADE_ID,
        symbol: "BTCUSDT",
        side: "SHORT",
        qty: "0.001",
        status: "UNKNOWN",
        refreshedAt: new Date().toISOString(),
      },
    });
    const closePreviewId = await seedClosePreview(true);
    const client = createMockClient({ closePositionsAfterOrder: true });
    const result = await executeTestnetClose({
      closePreviewId,
      doubleConfirm: true,
      client,
      getBinanceStatus: async () => connectedStatus(),
    });
    assert.equal(result.ok, false);
    assert.equal(client.orderCalls, 0);
  });

  it("close blocks if Binance disconnected", async () => {
    await seedMonitoredOpenPosition();
    const created = await createClosePreview({ tradeId: TRADE_ID });
    const client = createMockClient({ closePositionsAfterOrder: true });
    const result = await executeTestnetClose({
      closePreviewId: created.preview!.closePreviewId,
      doubleConfirm: true,
      client,
      getBinanceStatus: async () => disconnectedStatus(),
    });
    assert.equal(result.ok, false);
    assert.equal(client.orderCalls, 0);
  });

  it("close blocks if live enabled", async () => {
    await seedMonitoredOpenPosition();
    const closePreviewId = await seedClosePreview(true);
    process.env.BINANCE_LIVE_ENABLED = "true";
    assert.equal(isLiveEnabled(), true);
    const client = createMockClient({ closePositionsAfterOrder: true });
    const result = await executeTestnetClose({
      closePreviewId,
      doubleConfirm: true,
      client,
      getBinanceStatus: async () => connectedStatus(),
    });
    assert.equal(result.ok, false);
    assert.equal(client.orderCalls, 0);
  });

  it("close sends reduceOnly true", async () => {
    await seedMonitoredOpenPosition();
    const created = await createClosePreview({ tradeId: TRADE_ID });
    const client = createMockClient({ closePositionsAfterOrder: true });
    const result = await executeTestnetClose({
      closePreviewId: created.preview!.closePreviewId,
      doubleConfirm: true,
      client,
      getBinanceStatus: async () => connectedStatus(),
    });
    assert.equal(result.ok, true);
    assert.equal(client.orderCalls, 1);
    assert.equal(client.lastOrder?.reduceOnly, true);
  });

  it("successful close writes CLOSE_ORDER_EXECUTED", async () => {
    await seedMonitoredOpenPosition();
    const created = await createClosePreview({ tradeId: TRADE_ID });
    const client = createMockClient({ closePositionsAfterOrder: true });
    const result = await executeTestnetClose({
      closePreviewId: created.preview!.closePreviewId,
      doubleConfirm: true,
      client,
      getBinanceStatus: async () => connectedStatus(),
    });
    assert.equal(result.ok, true);
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "CLOSE_ORDER_EXECUTED"));
    assert.ok(events.some((e) => e.type === "MISSION_SNAPSHOT_UPDATED"));
  });

  it("flat position writes POSITION_CLOSED", async () => {
    await seedMonitoredOpenPosition();
    const created = await createClosePreview({ tradeId: TRADE_ID });
    const client = createMockClient({ closePositionsAfterOrder: true });
    const result = await executeTestnetClose({
      closePreviewId: created.preview!.closePreviewId,
      doubleConfirm: true,
      client,
      getBinanceStatus: async () => connectedStatus(),
    });
    assert.equal(result.ok, true);
    assert.equal(result.positionClosed, true);
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "POSITION_CLOSED" && e.tradeId === TRADE_ID));
    assert.equal(buildOpenTradesFromEvents(events).length, 0);
  });

  it("partial close keeps position OPEN", async () => {
    await seedMonitoredOpenPosition();
    const created = await createClosePreview({ tradeId: TRADE_ID });
    const client = createMockClient({
      positions: [{ symbol: "BTCUSDT", positionAmt: "-0.001" }],
      partialAfterOrderAmt: "-0.0005",
    });
    const result = await executeTestnetClose({
      closePreviewId: created.preview!.closePreviewId,
      doubleConfirm: true,
      client,
      getBinanceStatus: async () => connectedStatus(),
    });
    assert.equal(result.ok, true);
    assert.equal(result.positionClosed, false);
    const events = await getEvents();
    assert.equal(events.some((e) => e.type === "POSITION_CLOSED"), false);
    assert.ok(events.filter((e) => e.type === "POSITION_MONITORED").length >= 2);
    assert.equal(buildOpenTradesFromEvents(events).length, 1);
  });

  it("no secret returned in Binance status payload", async () => {
    const status = await getBinanceTestnetStatus();
    const json = JSON.stringify(status);
    assert.ok(!json.includes("test-secret"));
    assert.ok(!("apiSecret" in status));
    assert.ok(!("apiKey" in status));
  });
});
