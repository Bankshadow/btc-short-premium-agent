import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { BinanceTestnetClient } from "@/lib/execution/binance-testnet-client";
import type { BinanceTestnetStatus } from "@/lib/execution/binance-testnet-types";
import { createClosePreview } from "@/lib/execution/create-close-preview";
import { reviewCloseSafety } from "@/lib/execution/close-safety-gate";
import { executeTestnetClose } from "@/lib/execution/execute-testnet-close";
import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { newClosePreviewId, newPositionId } from "@/lib/journal/journal-types";
import { refreshOpenPositions } from "@/lib/positions/position-monitor";
import { isLiveEnabled } from "@/lib/risk/risk-gate";

const TRADE_ID = "trade-mvp5b-test";
const PREVIEW_ID = "prev-mvp5b-test";
const RUN_ID = "run-mvp5b";
const DL_ID = "dl-mvp5b";

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

function createMockClient(options?: {
  positions?: Array<{ symbol: string; positionAmt: string }>;
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
        entryPrice: "50000",
        unrealizedProfit: "1.5",
        markPrice: "50100",
      }));
    },
    async createMarketOrder() {
      state.orderCalls += 1;
      throw new Error("close order must not be sent in MVP 5B");
    },
  } as unknown as BinanceTestnetClient;
}

async function seedOpenTrade(side: "BUY" | "SELL" = "SELL") {
  await appendEvent({
    type: "ORDER_EXECUTED",
    environment: "testnet",
    runId: RUN_ID,
    decisionLogId: DL_ID,
    previewId: PREVIEW_ID,
    tradeId: TRADE_ID,
    payload: {
      symbol: "BTCUSDT",
      side,
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
      side,
      qty: "0.001",
      orderId: "ord-001",
      entryPrice: 50000,
    },
  });
}

async function seedMonitoredPosition(input?: {
  side?: "BUY" | "SELL";
  positionAmt?: string;
  status?: "OPEN" | "UNKNOWN";
}) {
  const side = input?.side ?? "SELL";
  const positionAmt = input?.positionAmt ?? (side === "SELL" ? "-0.001" : "0.001");
  await seedOpenTrade(side);
  await refreshOpenPositions({
    client: createMockClient({ positions: [{ symbol: "BTCUSDT", positionAmt }] }),
    getBinanceStatus: async () => connectedStatus(),
  });
  if (input?.status === "UNKNOWN") {
    await appendEvent({
      type: "POSITION_MONITORED",
      environment: "testnet",
      runId: RUN_ID,
      decisionLogId: DL_ID,
      previewId: PREVIEW_ID,
      tradeId: TRADE_ID,
      positionId: newPositionId(),
      payload: {
        tradeId: TRADE_ID,
        symbol: "BTCUSDT",
        side: side === "SELL" ? "SHORT" : "LONG",
        qty: "0.001",
        status: "UNKNOWN",
        refreshedAt: new Date().toISOString(),
      },
    });
  }
}

describe("MVP 5B close preview & close safety gate", () => {
  let tmpDir: string;
  let prevDir: string | undefined;
  let prevLive: string | undefined;
  let prevMockConn: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v2-mvp5b-"));
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

  it("close preview requires OPEN trade", async () => {
    const result = await createClosePreview({ tradeId: TRADE_ID });
    assert.equal(result.ok, false);
    assert.ok(result.blockReasons.includes("OPEN_TRADE_REQUIRED"));
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "CLOSE_PREVIEW_BLOCKED"));
  });

  it("close preview requires PositionSnapshot OPEN", async () => {
    await seedOpenTrade();
    const result = await createClosePreview({ tradeId: TRADE_ID });
    assert.equal(result.ok, false);
    assert.ok(result.blockReasons.includes("ACTIVE_POSITION_REQUIRED"));
  });

  it("close preview blocked if reconciliation BLOCKED", async () => {
    await seedMonitoredPosition();
    await appendEvent({
      type: "ORDER_EXECUTED",
      environment: "testnet",
      runId: RUN_ID,
      decisionLogId: DL_ID,
      previewId: "prev-2",
      tradeId: "trade-2",
      payload: {
        symbol: "BTCUSDT",
        side: "SELL",
        qty: "0.001",
        orderId: "ord-002",
        notionalUsd: 50,
      },
    });
    await appendEvent({
      type: "POSITION_OPENED",
      environment: "testnet",
      runId: RUN_ID,
      decisionLogId: DL_ID,
      previewId: "prev-2",
      tradeId: "trade-2",
      payload: {
        symbol: "BTCUSDT",
        side: "SELL",
        qty: "0.001",
        orderId: "ord-002",
        entryPrice: 50000,
      },
    });
    const result = await createClosePreview({ tradeId: TRADE_ID });
    assert.equal(result.ok, false);
    assert.ok(result.blockReasons.includes("RECONCILIATION_BLOCKED"));
  });

  it("close preview side for LONG = SELL", async () => {
    await seedMonitoredPosition({ side: "BUY", positionAmt: "0.001" });
    const result = await createClosePreview({ tradeId: TRADE_ID });
    assert.equal(result.ok, true);
    assert.equal(result.preview?.sideToClose, "SELL");
  });

  it("close preview side for SHORT = BUY", async () => {
    await seedMonitoredPosition({ side: "SELL", positionAmt: "-0.001" });
    const result = await createClosePreview({ tradeId: TRADE_ID });
    assert.equal(result.ok, true);
    assert.equal(result.preview?.sideToClose, "BUY");
  });

  it("close preview reduceOnly is true", async () => {
    await seedMonitoredPosition();
    const result = await createClosePreview({ tradeId: TRADE_ID });
    assert.equal(result.preview?.reduceOnly, true);
  });

  it("close review blocks without doubleConfirm", async () => {
    await seedMonitoredPosition();
    const created = await createClosePreview({ tradeId: TRADE_ID });
    const review = await reviewCloseSafety({
      closePreviewId: created.preview!.closePreviewId,
      doubleConfirm: false,
    });
    assert.equal(review.allowed, false);
    assert.ok(review.blockers.some((b) => b.code === "DOUBLE_CONFIRM_REQUIRED"));
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "DOUBLE_CONFIRM_REQUIRED"));
  });

  it("close review blocks if expired", async () => {
    await seedMonitoredPosition();
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
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
        createdAt: new Date().toISOString(),
        blocked: false,
        blockReasons: [],
        requiresDoubleConfirm: true,
        status: "ACTIVE",
      },
    });
    const review = await reviewCloseSafety({ closePreviewId, doubleConfirm: true });
    assert.equal(review.allowed, false);
    assert.ok(review.blockers.some((b) => b.code === "CLOSE_PREVIEW_EXPIRED"));
  });

  it("close review blocks if position UNKNOWN", async () => {
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
    const closePreviewId = newClosePreviewId();
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
        expiresAt: new Date(Date.now() + 900_000).toISOString(),
        createdAt: new Date().toISOString(),
        blocked: false,
        blockReasons: [],
        requiresDoubleConfirm: true,
        status: "ACTIVE",
      },
    });
    const review = await reviewCloseSafety({ closePreviewId, doubleConfirm: true });
    assert.equal(review.allowed, false);
    assert.ok(review.blockers.some((b) => b.code === "POSITION_STATE_UNKNOWN"));
  });

  it("close review blocks if live requested", async () => {
    process.env.BINANCE_LIVE_ENABLED = "true";
    await seedMonitoredPosition();
    const created = await createClosePreview({ tradeId: TRADE_ID });
    assert.equal(isLiveEnabled(), true);
    assert.equal(created.ok, false);
    assert.ok(created.blockReasons.includes("LIVE_ENVIRONMENT_BLOCKED"));
  });

  it("events written correctly", async () => {
    await seedMonitoredPosition();
    const created = await createClosePreview({ tradeId: TRADE_ID });
    assert.equal(created.eventType, "CLOSE_PREVIEW_CREATED");
    const review = await reviewCloseSafety({
      closePreviewId: created.preview!.closePreviewId,
      doubleConfirm: true,
    });
    assert.equal(review.allowed, true);
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "CLOSE_PREVIEW_CREATED"));
    assert.ok(events.some((e) => e.type === "CLOSE_REVIEWED"));
    const reviewed = events.find((e) => e.type === "CLOSE_REVIEWED");
    assert.equal(reviewed?.closePreviewId, created.preview!.closePreviewId);
    assert.equal(reviewed?.tradeId, TRADE_ID);
    assert.equal(reviewed?.decisionLogId, DL_ID);
  });

  it("no close order is sent via execute path when safety blocks", async () => {
    await seedMonitoredPosition();
    const created = await createClosePreview({ tradeId: TRADE_ID });
    const client = createMockClient({ positions: [{ symbol: "BTCUSDT", positionAmt: "-0.001" }] });
    const blocked = await executeTestnetClose({
      closePreviewId: created.preview!.closePreviewId,
      doubleConfirm: false,
      client,
      getBinanceStatus: async () => connectedStatus(),
    });
    assert.equal(blocked.ok, false);
    assert.equal((client as { orderCalls: number }).orderCalls, 0);
    const events = await getEvents();
    assert.equal(events.some((e) => e.type === "CLOSE_ORDER_EXECUTED"), false);
  });
});
