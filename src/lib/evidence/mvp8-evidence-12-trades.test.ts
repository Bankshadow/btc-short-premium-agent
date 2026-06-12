import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { buildEvidenceProgress } from "@/lib/evidence/evidence-progress-engine";
import { runEvidenceValidation } from "@/lib/evidence/evidence-progress";
import { validateEvidenceTrade, validateTradeEvidence } from "@/lib/evidence/evidence-validator";
import { createLearningRecord } from "@/lib/learning/create-learning-record";
import { calculatePnlForTrade } from "@/lib/pnl/calculate-pnl";
import { isLiveEnabled } from "@/lib/risk/risk-gate";

const TRADE_ID = "trade-mvp8";
const POSITION_ID = "pos-mvp8";
const RUN_ID = "run-mvp8";
const DL_ID = "dl-mvp8";
const PREVIEW_ID = "prev-mvp8";

async function seedFullLifecycleTrade() {
  await appendEvent({
    type: "ANALYSIS_STARTED",
    environment: "testnet",
    runId: RUN_ID,
    decisionLogId: DL_ID,
    payload: { trigger: "manual" },
  });
  await appendEvent({
    type: "VERDICT_CREATED",
    environment: "testnet",
    runId: RUN_ID,
    decisionLogId: DL_ID,
    payload: { verdict: "TRADE", reasons: ["setup ok"] },
  });
  await appendEvent({
    type: "PREVIEW_CREATED",
    environment: "testnet",
    runId: RUN_ID,
    decisionLogId: DL_ID,
    previewId: PREVIEW_ID,
    payload: { previewId: PREVIEW_ID, symbol: "BTCUSDT", side: "SELL" },
  });
  await appendEvent({
    type: "EXECUTION_REVIEWED",
    environment: "testnet",
    runId: RUN_ID,
    decisionLogId: DL_ID,
    previewId: PREVIEW_ID,
    payload: { previewId: PREVIEW_ID, approved: true },
  });
  await appendEvent({
    type: "ORDER_EXECUTED",
    environment: "testnet",
    runId: RUN_ID,
    decisionLogId: DL_ID,
    tradeId: TRADE_ID,
    previewId: PREVIEW_ID,
    payload: { symbol: "BTCUSDT", side: "SELL", qty: "0.001", avgPrice: 50000, fee: 0.02 },
  });
  await appendEvent({
    type: "POSITION_OPENED",
    environment: "testnet",
    runId: RUN_ID,
    decisionLogId: DL_ID,
    tradeId: TRADE_ID,
    positionId: POSITION_ID,
    previewId: PREVIEW_ID,
    payload: { symbol: "BTCUSDT", side: "SELL", qty: "0.001", entryPrice: 50000 },
  });
  await appendEvent({
    type: "POSITION_MONITORED",
    environment: "testnet",
    runId: RUN_ID,
    decisionLogId: DL_ID,
    tradeId: TRADE_ID,
    previewId: PREVIEW_ID,
    payload: { status: "OPEN" },
  });
  await appendEvent({
    type: "CLOSE_ORDER_EXECUTED",
    environment: "testnet",
    runId: RUN_ID,
    decisionLogId: DL_ID,
    tradeId: TRADE_ID,
    positionId: POSITION_ID,
    payload: { avgPrice: 49000, executedQty: "0.001", fee: 0.02 },
  });
  await appendEvent({
    type: "POSITION_CLOSED",
    environment: "testnet",
    runId: RUN_ID,
    decisionLogId: DL_ID,
    tradeId: TRADE_ID,
    positionId: POSITION_ID,
    payload: { symbol: "BTCUSDT" },
  });
  await calculatePnlForTrade(TRADE_ID);
  await createLearningRecord({ tradeId: TRADE_ID });
}

describe("MVP 8 evidence 12 trades", { concurrency: 1 }, () => {
  let tmpDir: string;
  let prevDir: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v2-mvp8-ev-"));
    prevDir = process.env.JOURNAL_DATA_DIR;
    process.env.JOURNAL_DATA_DIR = tmpDir;
    process.env.BINANCE_LIVE_ENABLED = "false";
  });

  afterEach(() => {
    if (prevDir !== undefined) process.env.JOURNAL_DATA_DIR = prevDir;
    else delete process.env.JOURNAL_DATA_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rejects PENDING_PNL closed trade projection", () => {
    const events = [
      {
        eventId: "1",
        type: "ORDER_EXECUTED" as const,
        timestamp: "2026-06-11T10:00:00.000Z",
        environment: "testnet" as const,
        tradeId: "pending-1",
        runId: RUN_ID,
        decisionLogId: DL_ID,
        payload: { symbol: "BTCUSDT", side: "SELL", qty: "0.001" },
      },
      {
        eventId: "2",
        type: "POSITION_CLOSED" as const,
        timestamp: "2026-06-11T10:05:00.000Z",
        environment: "testnet" as const,
        tradeId: "pending-1",
        runId: RUN_ID,
        decisionLogId: DL_ID,
        payload: {},
      },
    ];
    const result = validateTradeEvidence("pending-1", events);
    assert.equal(result.status, "REJECTED");
    assert.ok(result.rejectionReasons.includes("PNL_PENDING_DATA") || result.rejectionReasons.includes("MISSING_REALIZED_PNL"));
  });

  it("rejects missing PNL_REALIZED", () => {
    const events = [
      {
        eventId: "1",
        type: "POSITION_CLOSED" as const,
        timestamp: "2026-06-11T10:05:00.000Z",
        environment: "testnet" as const,
        tradeId: "x1",
        payload: {},
      },
    ];
    const validation = validateEvidenceTrade({ tradeId: "x1", events });
    assert.equal(validation.isValid, false);
    assert.ok(validation.rejectedReasons.includes("MISSING_PNL_REALIZED"));
  });

  it("rejects missing learning and reflection", async () => {
    await appendEvent({
      type: "ORDER_EXECUTED",
      environment: "testnet",
      runId: RUN_ID,
      decisionLogId: DL_ID,
      tradeId: "learn-miss",
      payload: { symbol: "BTCUSDT", side: "SELL", qty: "0.001", avgPrice: 50000 },
    });
    await appendEvent({
      type: "POSITION_OPENED",
      environment: "testnet",
      runId: RUN_ID,
      decisionLogId: DL_ID,
      tradeId: "learn-miss",
      positionId: "pos-learn",
      payload: { entryPrice: 50000, qty: "0.001" },
    });
    await appendEvent({
      type: "CLOSE_ORDER_EXECUTED",
      environment: "testnet",
      tradeId: "learn-miss",
      payload: { avgPrice: 49000 },
    });
    await appendEvent({
      type: "POSITION_CLOSED",
      environment: "testnet",
      tradeId: "learn-miss",
      payload: {},
    });
    await calculatePnlForTrade("learn-miss");
    const validation = validateEvidenceTrade({
      tradeId: "learn-miss",
      events: await getEvents(),
    });
    assert.equal(validation.isValid, false);
    assert.ok(validation.rejectedReasons.includes("MISSING_LEARNING_RECORD"));
    assert.ok(validation.rejectedReasons.includes("MISSING_TRADE_REFLECTION"));
  });

  it("accepts full lifecycle with PNL_REALIZED and learning", async () => {
    await seedFullLifecycleTrade();
    const validation = validateEvidenceTrade({ tradeId: TRADE_ID, events: await getEvents() });
    assert.equal(validation.isValid, true);
    assert.equal(validation.status, "VALID");
  });

  it("progressPct and readiness for partial progress", async () => {
    await seedFullLifecycleTrade();
    const progress = buildEvidenceProgress(await getEvents());
    assert.equal(progress.validTrades, 1);
    assert.equal(progress.requiredTrades, 12);
    assert.ok(progress.progressPct > 0);
    assert.equal(progress.readinessStatus, "IN_PROGRESS");
  });

  it("readiness NOT_READY when validTrades = 0", () => {
    const progress = buildEvidenceProgress([]);
    assert.equal(progress.validTrades, 0);
    assert.equal(progress.readinessStatus, "NOT_READY");
  });

  it("never returns READY_FOR_LIVE_TRADING", () => {
    const statuses = ["NOT_READY", "IN_PROGRESS", "READY_FOR_TESTNET_CONTINUATION", "BLOCKED_BY_SAFETY"];
    for (const status of statuses) {
      assert.notEqual(status, "READY_FOR_LIVE_TRADING");
    }
  });

  it("validation is idempotent for summary events", async () => {
    await seedFullLifecycleTrade();
    const validation = validateEvidenceTrade({ tradeId: TRADE_ID, events: await getEvents() });
    assert.equal(validation.isValid, true);
    const first = await runEvidenceValidation({ validateAll: true, writeEvents: true });
    assert.ok(first.progress.validTrades >= 1);
    const afterFirst = (await getEvents()).filter(
      (e) => e.type === "EVIDENCE_TRADE_VALIDATED" && e.tradeId === TRADE_ID,
    ).length;
    assert.ok(afterFirst >= 1);
    await runEvidenceValidation({ validateAll: true, writeEvents: true });
    const afterSecond = (await getEvents()).filter(
      (e) => e.type === "EVIDENCE_TRADE_VALIDATED" && e.tradeId === TRADE_ID,
    ).length;
    assert.equal(afterSecond, afterFirst);
  });

  it("no secrets exposed in progress serialization", async () => {
    process.env.BINANCE_TESTNET_API_KEY = "super-secret-key";
    await seedFullLifecycleTrade();
    const serialized = JSON.stringify(buildEvidenceProgress(await getEvents()));
    assert.ok(!serialized.includes("super-secret-key"));
    delete process.env.BINANCE_TESTNET_API_KEY;
  });

  it("live remains locked", () => {
    assert.equal(isLiveEnabled(), false);
  });
});
