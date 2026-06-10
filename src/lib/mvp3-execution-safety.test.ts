import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { appendEvent } from "@/lib/journal/journal-query";
import { createTestnetPreview } from "@/lib/execution/create-preview";
import { reviewExecutionSafety } from "@/lib/execution/execution-safety-gate";
import { getEvents } from "@/lib/journal/journal-query";

describe("MVP 3 execution safety gate", () => {
  let tmpDir: string;
  let prevDir: string | undefined;
  let prevMockConn: string | undefined;
  let prevKill: string | undefined;
  let previewId: string;

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v2-mvp3-"));
    prevDir = process.env.JOURNAL_DATA_DIR;
    prevMockConn = process.env.BINANCE_TESTNET_MOCK_CONNECTED;
    prevKill = process.env.KILL_SWITCH_ACTIVE;
    process.env.JOURNAL_DATA_DIR = tmpDir;
    process.env.BINANCE_TESTNET_ENABLED = "true";
    process.env.BINANCE_TESTNET_MOCK_CONNECTED = "true";
    process.env.KILL_SWITCH_ACTIVE = "false";
    process.env.BINANCE_LIVE_ENABLED = "false";

    const created = await createTestnetPreview({
      runId: "run-safety",
      decisionLogId: "dl-safety",
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
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("missing double confirm blocks", async () => {
    const r = await reviewExecutionSafety({ previewId, doubleConfirm: false });
    assert.equal(r.allowed, false);
    assert.ok(r.blockers.some((b) => b.code === "DOUBLE_CONFIRM_REQUIRED"));
  });

  it("missing previewId blocks", async () => {
    const r = await reviewExecutionSafety({ previewId: "", doubleConfirm: true });
    assert.equal(r.allowed, false);
    assert.ok(r.blockers.some((b) => b.code === "MISSING_PREVIEW_ID"));
  });

  it("missing decisionLogId blocks", async () => {
    const pid = "prev-no-dl";
    await appendEvent({
      type: "PREVIEW_CREATED",
      environment: "testnet",
      runId: "run-no-dl",
      decisionLogId: "",
      previewId: pid,
      payload: {
        previewId: pid,
        runId: "run-no-dl",
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
    const r = await reviewExecutionSafety({ previewId: pid, doubleConfirm: true });
    assert.equal(r.allowed, false);
    assert.ok(r.blockers.some((b) => b.code === "MISSING_DECISION_LOG_ID"));
  });

  it("unknown testnet status blocks", async () => {
    delete process.env.BINANCE_TESTNET_MOCK_CONNECTED;
    const r = await reviewExecutionSafety({ previewId, doubleConfirm: true });
    assert.equal(r.allowed, false);
    assert.ok(r.blockers.some((b) => b.code === "TESTNET_DISCONNECTED"));
    process.env.BINANCE_TESTNET_MOCK_CONNECTED = "true";
  });

  it("live environment blocks", async () => {
    process.env.BINANCE_LIVE_ENABLED = "true";
    const r = await reviewExecutionSafety({ previewId, doubleConfirm: true });
    assert.equal(r.allowed, false);
    assert.ok(r.blockers.some((b) => b.code === "LIVE_ENVIRONMENT_BLOCKED"));
    process.env.BINANCE_LIVE_ENABLED = "false";
  });

  it("expired preview blocks", async () => {
    const pid = "prev-expired";
    await appendEvent({
      type: "PREVIEW_CREATED",
      environment: "testnet",
      runId: "run-exp",
      decisionLogId: "dl-exp",
      previewId: pid,
      payload: {
        previewId: pid,
        runId: "run-exp",
        decisionLogId: "dl-exp",
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
    const r = await reviewExecutionSafety({ previewId: pid, doubleConfirm: true });
    assert.equal(r.allowed, false);
    assert.ok(r.blockers.some((b) => b.code === "PREVIEW_EXPIRED"));
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "PREVIEW_EXPIRED"));
  });

  it("duplicate order blocks", async () => {
    await appendEvent({
      type: "ORDER_EXECUTED",
      environment: "testnet",
      runId: "run-safety",
      decisionLogId: "dl-safety",
      previewId,
      tradeId: "trade-dup",
      payload: { previewId, symbol: "BTCUSDT", side: "SELL" },
    });
    const r = await reviewExecutionSafety({ previewId, doubleConfirm: true });
    assert.equal(r.allowed, false);
    assert.ok(r.blockers.some((b) => b.code === "DUPLICATE_ORDER_DETECTED"));
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "DUPLICATE_ORDER_BLOCKED"));
  });

  it("clean preview with doubleConfirm passes safety gate", async () => {
    const fresh = await createTestnetPreview({
      runId: "run-pass",
      decisionLogId: "dl-pass",
    });
    const pid = fresh.preview!.previewId;
    const r = await reviewExecutionSafety({ previewId: pid, doubleConfirm: true });
    assert.equal(r.allowed, true);
    assert.equal(r.blocked, false);
  });

  it("blocked review writes EXECUTE_BLOCKED", async () => {
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "EXECUTE_BLOCKED"));
  });

  it("every review writes EXECUTION_REVIEWED", async () => {
    const events = await getEvents();
    const reviewed = events.filter((e) => e.type === "EXECUTION_REVIEWED");
    assert.ok(reviewed.length >= 5);
  });

  it("no order execution occurs", async () => {
    const events = await getEvents();
    const orders = events.filter((e) => e.type === "ORDER_EXECUTED");
    assert.equal(orders.length, 1);
  });
});
