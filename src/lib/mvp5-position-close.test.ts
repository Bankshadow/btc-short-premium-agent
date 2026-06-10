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
import {
  getOpenPositionsView,
  refreshOpenPositions,
} from "@/lib/positions/position-monitor";
import { reconcilePositions } from "@/lib/positions/position-reconcile";
import { buildOpenTradesFromEvents } from "@/lib/trades/trade-store";
import { isLiveEnabled } from "@/lib/risk/risk-gate";
import { getBinanceTestnetStatus } from "@/lib/execution/binance-testnet-status";

const TRADE_ID = "trade-mvp5-test";
const PREVIEW_ID = "prev-mvp5-test";
const RUN_ID = "run-mvp5";
const DL_ID = "dl-mvp5";

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
  positions?: Array<{
    symbol: string;
    positionAmt: string;
    entryPrice?: string;
    unrealizedProfit?: string;
    markPrice?: string;
  }>;
  closePositionsAfterOrder?: boolean;
}): BinanceTestnetClient {
  const state = { orderCalls: 0, positions: options?.positions ?? [] };
  return {
    get orderCalls() {
      return state.orderCalls;
    },
    async getPositions() {
      return state.positions.map((p) => ({
        symbol: p.symbol,
        positionAmt: p.positionAmt,
        entryPrice: p.entryPrice ?? "50000",
        unrealizedProfit: p.unrealizedProfit ?? "1.5",
        markPrice: p.markPrice ?? "50100",
      }));
    },
    async createMarketOrder(input) {
      state.orderCalls += 1;
      assert.equal(input.reduceOnly, true, "close order must be reduceOnly");
      if (options?.closePositionsAfterOrder) {
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
  } as unknown as BinanceTestnetClient;
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

async function seedClosePreview(active = true) {
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
      reduceOnly: true,
      environment: "TESTNET",
      expiresAt: active
        ? new Date(Date.now() + 900_000).toISOString()
        : new Date(Date.now() - 60_000).toISOString(),
      createdAt: new Date().toISOString(),
      blocked: false,
      blockReasons: [],
      requiresDoubleConfirm: true,
    },
  });
  return closePreviewId;
}

describe("MVP 5 position monitor & reduce-only close", () => {
  let tmpDir: string;
  let prevDir: string | undefined;
  let prevLive: string | undefined;
  let prevMockConn: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v2-mvp5-"));
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

  it("refresh positions returns zero-state when no open trades", async () => {
    const result = await refreshOpenPositions({
      client: createMockClient(),
      getBinanceStatus: async () => connectedStatus(),
    });
    assert.equal(result.snapshots.length, 0);
    assert.equal(result.reconciliation.status, "OK");
    assert.match(result.message, /zero state/i);
  });

  it("refresh positions appends POSITION_MONITORED", async () => {
    await seedOpenTrade();
    await refreshOpenPositions({
      client: createMockClient({
        positions: [{ symbol: "BTCUSDT", positionAmt: "-0.001" }],
      }),
      getBinanceStatus: async () => connectedStatus(),
    });
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "POSITION_MONITORED" && e.tradeId === TRADE_ID));
  });

  it("reconciliation warns if local OPEN trade missing Binance position", () => {
    const openTrades = buildOpenTradesFromEvents([]);
    const trade = {
      tradeId: TRADE_ID,
      previewId: PREVIEW_ID,
      runId: RUN_ID,
      decisionLogId: DL_ID,
      environment: "TESTNET" as const,
      symbol: "BTCUSDT",
      side: "SELL" as const,
      qty: "0.001",
      notionalUsd: 50,
      orderId: "ord-001",
      clientOrderId: "cli-001",
      entryPrice: 50000,
      status: "OPEN" as const,
      openedAt: new Date().toISOString(),
      source: "BINANCE_TESTNET" as const,
    };
    const result = reconcilePositions({
      openTrades: [trade],
      binancePositions: [],
      snapshots: [],
      lastMonitoredAt: new Date().toISOString(),
      binanceConnected: true,
    });
    assert.ok(
      result.issues.some((i) => i.code === "LOCAL_TRADE_MISSING_BINANCE_POSITION"),
    );
    assert.equal(result.status, "WARNING");
  });

  it("reconciliation warns if Binance position missing local open trade", async () => {
    const result = reconcilePositions({
      openTrades: [],
      binancePositions: [
        {
          symbol: "BTCUSDT",
          positionAmt: "-0.001",
          entryPrice: "50000",
          unrealizedProfit: "0",
        },
      ],
      snapshots: [],
      lastMonitoredAt: new Date().toISOString(),
      binanceConnected: true,
    });
    assert.ok(
      result.issues.some((i) => i.code === "BINANCE_POSITION_MISSING_LOCAL_TRADE"),
    );
  });

  it("close preview requires OPEN trade", async () => {
    const result = await createClosePreview({ tradeId: "missing-trade" });
    assert.equal(result.ok, false);
    assert.ok(result.blockReasons.includes("OPEN_TRADE_REQUIRED"));
  });

  it("close preview requires active position", async () => {
    await seedOpenTrade();
    const result = await createClosePreview({ tradeId: TRADE_ID });
    assert.equal(result.ok, false);
    assert.ok(result.blockReasons.includes("ACTIVE_POSITION_REQUIRED"));
  });

  it("close preview is always reduceOnly", async () => {
    await seedMonitoredOpenPosition();
    const result = await createClosePreview({ tradeId: TRADE_ID });
    assert.equal(result.ok, true);
    assert.equal(result.preview?.reduceOnly, true);
    assert.equal(result.preview?.sideToClose, "BUY");
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

  it("close blocks if position UNKNOWN", async () => {
    await seedOpenTrade();
    await refreshOpenPositions({
      client: createMockClient({ positions: [] }),
      getBinanceStatus: async () => disconnectedStatus(),
    });
    const created = await createClosePreview({ tradeId: TRADE_ID });
    assert.equal(created.ok, false);
    assert.ok(created.blockReasons.includes("ACTIVE_POSITION_REQUIRED"));
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
    const closePreviewId = newClosePreviewId();
    await appendEvent({
      type: "CLOSE_PREVIEW_CREATED",
      environment: "testnet",
      runId: RUN_ID,
      decisionLogId: DL_ID,
      tradeId: TRADE_ID,
      closePreviewId,
      payload: {
        closePreviewId,
        tradeId: TRADE_ID,
        runId: RUN_ID,
        decisionLogId: DL_ID,
        symbol: "BTCUSDT",
        sideToClose: "BUY",
        qty: "0.001",
        orderType: "MARKET",
        reduceOnly: false,
        environment: "TESTNET",
        expiresAt: new Date(Date.now() + 900_000).toISOString(),
        createdAt: new Date().toISOString(),
        blocked: false,
        blockReasons: [],
      },
    });
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

  it("successful close appends CLOSE_ORDER_EXECUTED", async () => {
    await seedMonitoredOpenPosition();
    const created = await createClosePreview({ tradeId: TRADE_ID });
    const client = createMockClient({ closePositionsAfterOrder: true });
    const result = await executeTestnetClose({
      closePreviewId: created.preview!.closePreviewId,
      doubleConfirm: true,
      client,
      getBinanceStatus: async () => connectedStatus(),
    });
    if (!result.ok) {
      assert.fail(`close failed: ${result.message} | ${JSON.stringify(result.blockers)}`);
    }
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "CLOSE_ORDER_EXECUTED"));
    assert.ok(events.some((e) => e.type === "POSITION_CLOSED" && e.tradeId === TRADE_ID));
  });

  it("live trading remains locked", () => {
    assert.equal(isLiveEnabled(), false);
  });

  it("no API secret is returned in Binance status payload", async () => {
    const status = await getBinanceTestnetStatus();
    const json = JSON.stringify(status);
    assert.ok(!json.includes("test-secret"));
    assert.ok(!("apiSecret" in status));
    assert.ok(!("apiKey" in status));
  });

  it("getOpenPositionsView returns clean zero-state when no open trades", async () => {
    const view = await getOpenPositionsView();
    assert.equal(view.snapshots.length, 0);
    assert.equal(view.reconciliation.status, "OK");
  });
});
