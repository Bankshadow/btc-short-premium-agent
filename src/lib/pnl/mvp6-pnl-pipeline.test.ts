import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { validateTradeEvidence } from "@/lib/evidence/evidence-validator";
import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { buildMissionSnapshot } from "@/lib/mission/mission-snapshot";
import { calculatePnlFromInput, calculateRealizedPnl, validatePnlInput } from "@/lib/pnl/pnl-calculator";
import { processPnlCalculation } from "@/lib/pnl/pnl-engine";
import { listPendingPnlTrades } from "@/lib/pnl/pnl-pending";
import { isLiveEnabled } from "@/lib/risk/risk-gate";
import type { PnlInput } from "@/lib/pnl/pnl-types";

const TRADE_ID = "trade-mvp6-pipeline";
const POSITION_ID = "pos-mvp6-pipeline";
const RUN_ID = "run-mvp6-pipeline";

function validShortInput(overrides: Partial<PnlInput> = {}): PnlInput {
  return {
    tradeId: TRADE_ID,
    positionId: POSITION_ID,
    symbol: "BTCUSDT",
    side: "SHORT",
    qty: "0.001",
    entryPrice: 50000,
    exitPrice: 49000,
    entryFee: 0.02,
    exitFee: 0.02,
    openedAt: "2026-06-11T10:00:00.000Z",
    closedAt: "2026-06-11T10:05:00.000Z",
    environment: "TESTNET",
    ...overrides,
  };
}

async function seedClosedTradeWithFills() {
  await appendEvent({
    type: "ORDER_EXECUTED",
    environment: "testnet",
    runId: RUN_ID,
    tradeId: TRADE_ID,
    positionId: POSITION_ID,
    payload: { symbol: "BTCUSDT", side: "SELL", qty: "0.001", avgPrice: 50000, fee: 0.02 },
  });
  await appendEvent({
    type: "POSITION_OPENED",
    environment: "testnet",
    runId: RUN_ID,
    tradeId: TRADE_ID,
    positionId: POSITION_ID,
    payload: { symbol: "BTCUSDT", side: "SELL", qty: "0.001", entryPrice: 50000 },
  });
  await appendEvent({
    type: "CLOSE_ORDER_EXECUTED",
    environment: "testnet",
    runId: RUN_ID,
    tradeId: TRADE_ID,
    positionId: POSITION_ID,
    payload: { avgPrice: 49000, executedQty: "0.001", fee: 0.02 },
  });
  await appendEvent({
    type: "POSITION_CLOSED",
    environment: "testnet",
    runId: RUN_ID,
    tradeId: TRADE_ID,
    positionId: POSITION_ID,
    payload: { symbol: "BTCUSDT", realizedPnlPending: true },
  });
}

describe("MVP 6 PnL fill data pipeline", () => {
  let tmpDir: string;
  let prevDir: string | undefined;
  let prevLive: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v2-mvp6-pnl-"));
    prevDir = process.env.JOURNAL_DATA_DIR;
    prevLive = process.env.BINANCE_LIVE_ENABLED;
    process.env.JOURNAL_DATA_DIR = tmpDir;
    process.env.BINANCE_LIVE_ENABLED = "false";
  });

  afterEach(() => {
    if (prevDir !== undefined) process.env.JOURNAL_DATA_DIR = prevDir;
    else delete process.env.JOURNAL_DATA_DIR;
    if (prevLive !== undefined) process.env.BINANCE_LIVE_ENABLED = prevLive;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("calculates LONG PnL", () => {
    const result = calculatePnlFromInput(validShortInput({ side: "LONG", entryPrice: 50000, exitPrice: 51000 }));
    assert.equal(result.ok, true);
    assert.ok((result.netPnl ?? 0) > 0);
  });

  it("calculates SHORT PnL", () => {
    const result = calculatePnlFromInput(validShortInput());
    assert.equal(result.ok, true);
    assert.ok((result.netPnl ?? 0) > 0);
  });

  it("fees reduce net PnL", () => {
    const withFees = calculatePnlFromInput(validShortInput({ entryFee: 1, exitFee: 1 }));
    const noFees = calculatePnlFromInput(validShortInput({ entryFee: 0, exitFee: 0 }));
    assert.ok((withFees.netPnl ?? 0) < (noFees.netPnl ?? 0));
  });

  it("qty = 0 returns PENDING_DATA", () => {
    const result = calculatePnlFromInput(validShortInput({ qty: "0" }));
    assert.equal(result.ok, false);
    assert.ok(result.reasons.includes("ZERO_QTY"));
  });

  it("missing entry price returns PENDING_DATA", () => {
    const result = calculateRealizedPnl({
      tradeId: TRADE_ID,
      symbol: "BTCUSDT",
      side: "BUY",
      qty: "0.001",
      entryPrice: null,
      exitPrice: 50000,
    });
    assert.equal(result.ok, false);
    assert.ok(result.reasons.includes("MISSING_ENTRY_PRICE"));
  });

  it("missing exit price returns PENDING_DATA", () => {
    const result = calculatePnlFromInput(validShortInput({ exitPrice: null }));
    assert.equal(result.ok, false);
    assert.ok(result.reasons.includes("MISSING_EXIT_PRICE"));
  });

  it("live environment is blocked", () => {
    const result = validatePnlInput(validShortInput({ environment: "LIVE" }));
    assert.equal(result.valid, false);
    assert.ok(result.reasons.includes("LIVE_ENV_BLOCKED"));
  });

  it("processPnlCalculation is idempotent for PNL_REALIZED", async () => {
    await seedClosedTradeWithFills();
    const first = await processPnlCalculation({ tradeId: TRADE_ID });
    assert.equal(first.status, "REALIZED");
    const second = await processPnlCalculation({ tradeId: TRADE_ID });
    assert.equal(second.alreadyRealized, true);
    assert.equal(
      (await getEvents()).filter((e) => e.type === "PNL_REALIZED" && e.tradeId === TRADE_ID).length,
      1,
    );
  });

  it("emits lifecycle events on successful calculation", async () => {
    await seedClosedTradeWithFills();
    await processPnlCalculation({ tradeId: TRADE_ID });
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "PNL_CALCULATION_STARTED"));
    assert.ok(events.some((e) => e.type === "PNL_REALIZED"));
    assert.ok(events.some((e) => e.type === "TRADE_RESULT_CLASSIFIED"));
    assert.ok(events.some((e) => e.type === "MISSION_SNAPSHOT_UPDATED"));
  });

  it("emits PNL_PENDING_DATA instead of fake PNL_REALIZED when fill data missing", async () => {
    await appendEvent({
      type: "POSITION_CLOSED",
      environment: "testnet",
      tradeId: "pending-only",
      payload: { symbol: "BTCUSDT", qty: "0.001" },
    });
    const result = await processPnlCalculation({ tradeId: "pending-only" });
    assert.equal(result.status, "PENDING_DATA");
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "PNL_PENDING_DATA" && e.tradeId === "pending-only"));
    assert.equal(
      events.some((e) => e.type === "PNL_REALIZED" && e.tradeId === "pending-only"),
      false,
    );
  });

  it("mission netPnl only uses PNL_REALIZED", async () => {
    await seedClosedTradeWithFills();
    await processPnlCalculation({ tradeId: TRADE_ID });
    const mission = buildMissionSnapshot(await getEvents());
    assert.ok(mission.netPnl !== 0);
  });

  it("PENDING_PNL is rejected from evidence", async () => {
    await appendEvent({
      type: "ORDER_EXECUTED",
      environment: "testnet",
      tradeId: "ev-pending",
      payload: { symbol: "BTCUSDT", side: "SELL", qty: "0.001" },
    });
    await appendEvent({
      type: "POSITION_OPENED",
      environment: "testnet",
      tradeId: "ev-pending",
      payload: { symbol: "BTCUSDT", side: "SELL", qty: "0.001" },
    });
    await appendEvent({
      type: "POSITION_CLOSED",
      environment: "testnet",
      tradeId: "ev-pending",
      payload: { symbol: "BTCUSDT", realizedPnlPending: true },
    });
    const evidence = validateTradeEvidence("ev-pending", await getEvents());
    assert.equal(evidence.status, "REJECTED");
    assert.ok(
      evidence.rejectionReasons.includes("PNL_PENDING_DATA") ||
        evidence.rejectionReasons.includes("MISSING_REALIZED_PNL"),
    );
  });

  it("PNL_REALIZED without learning is not valid evidence", async () => {
    await seedClosedTradeWithFills();
    await processPnlCalculation({ tradeId: TRADE_ID });
    const evidence = validateTradeEvidence(TRADE_ID, await getEvents());
    assert.equal(evidence.status, "REJECTED");
    assert.ok(!evidence.rejectionReasons.includes("PNL_PENDING_DATA"));
  });

  it("listPendingPnlTrades explains pending closed trades", async () => {
    await seedClosedTradeWithFills();
    const pending = listPendingPnlTrades(await getEvents());
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.tradeId, TRADE_ID);
    assert.match(pending[0]?.message ?? "", /pending/i);
  });

  it("does not expose secrets in pending list serialization", async () => {
    process.env.BINANCE_TESTNET_API_KEY = "super-secret-key";
    await seedClosedTradeWithFills();
    const serialized = JSON.stringify(listPendingPnlTrades(await getEvents()));
    assert.ok(!serialized.includes("super-secret-key"));
    delete process.env.BINANCE_TESTNET_API_KEY;
  });

  it("live remains locked", () => {
    assert.equal(isLiveEnabled(), false);
  });
});
