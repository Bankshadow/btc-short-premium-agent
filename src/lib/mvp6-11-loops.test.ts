import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { calculateRealizedPnl } from "@/lib/pnl/pnl-calculator";
import { classifyTradeResult } from "@/lib/pnl/trade-result-classifier";
import { calculatePnlForTrade } from "@/lib/pnl/calculate-pnl";
import { createLearningRecord } from "@/lib/learning/create-learning-record";
import { getEvidenceProgressView } from "@/lib/evidence/evidence-progress";
import { runEngineHealthCheck } from "@/lib/health/engine-health-check";
import { buildStrategyHealthView } from "@/lib/strategy/strategy-health";
import { runMirofishSwarm } from "@/lib/skills/mirofish-swarm/swarm-runner";
import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { buildMissionSnapshot } from "@/lib/mission/mission-snapshot";
import { isLiveEnabled } from "@/lib/risk/risk-gate";

const TRADE_ID = "trade-mvp6";
const RUN_ID = "run-mvp6";
const DL_ID = "dl-mvp6";

async function seedClosedTradeWithPrices() {
  await appendEvent({
    type: "ORDER_EXECUTED",
    environment: "testnet",
    runId: RUN_ID,
    decisionLogId: DL_ID,
    tradeId: TRADE_ID,
    payload: { symbol: "BTCUSDT", side: "SELL", qty: "0.001", orderId: "o1", avgPrice: 50000 },
  });
  await appendEvent({
    type: "POSITION_OPENED",
    environment: "testnet",
    runId: RUN_ID,
    decisionLogId: DL_ID,
    tradeId: TRADE_ID,
    payload: { symbol: "BTCUSDT", side: "SELL", qty: "0.001", entryPrice: 50000 },
  });
  await appendEvent({
    type: "CLOSE_ORDER_EXECUTED",
    environment: "testnet",
    runId: RUN_ID,
    decisionLogId: DL_ID,
    tradeId: TRADE_ID,
    payload: { avgPrice: 49000, executedQty: "0.001" },
  });
  await appendEvent({
    type: "POSITION_CLOSED",
    environment: "testnet",
    runId: RUN_ID,
    decisionLogId: DL_ID,
    tradeId: TRADE_ID,
    payload: { symbol: "BTCUSDT", realizedPnlPending: true },
  });
}

describe("MVP 6-11 loops", () => {
  let tmpDir: string;
  let prevDir: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v2-mvp6-"));
    prevDir = process.env.JOURNAL_DATA_DIR;
    process.env.JOURNAL_DATA_DIR = tmpDir;
    process.env.BINANCE_LIVE_ENABLED = "false";
    process.env.BINANCE_TESTNET_ENABLED = "true";
    process.env.BINANCE_TESTNET_MOCK_CONNECTED = "true";
  });

  afterEach(() => {
    if (prevDir !== undefined) process.env.JOURNAL_DATA_DIR = prevDir;
    else delete process.env.JOURNAL_DATA_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("calculate long PnL", () => {
    const r = calculateRealizedPnl({
      tradeId: TRADE_ID,
      symbol: "BTCUSDT",
      side: "BUY",
      qty: "0.001",
      entryPrice: 50000,
      exitPrice: 51000,
    });
    assert.equal(r.ok, true);
    assert.ok((r.netPnl ?? 0) > 0);
  });

  it("calculate short PnL", () => {
    const r = calculateRealizedPnl({
      tradeId: TRADE_ID,
      symbol: "BTCUSDT",
      side: "SELL",
      qty: "0.001",
      entryPrice: 50000,
      exitPrice: 49000,
    });
    assert.equal(r.ok, true);
    assert.ok((r.netPnl ?? 0) > 0);
  });

  it("classify WIN LOSS BREAKEVEN", () => {
    assert.equal(classifyTradeResult(1), "WIN");
    assert.equal(classifyTradeResult(-1), "LOSS");
    assert.equal(classifyTradeResult(0), "BREAKEVEN");
  });

  it("handle missing entry price", () => {
    const r = calculateRealizedPnl({
      tradeId: TRADE_ID,
      symbol: "BTCUSDT",
      side: "BUY",
      qty: "0.001",
      entryPrice: null,
      exitPrice: 50000,
    });
    assert.equal(r.ok, false);
    assert.equal(r.status, "PNL_PENDING_DATA");
  });

  it("POSITION_CLOSED leads to PNL_REALIZED", async () => {
    await seedClosedTradeWithPrices();
    const result = await calculatePnlForTrade(TRADE_ID);
    assert.equal(result.ok, true);
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "PNL_REALIZED"));
    assert.ok(events.some((e) => e.type === "TRADE_RESULT_CLASSIFIED"));
  });

  it("post-trade loop fires evidence, health, portfolio, briefing after PnL", async () => {
    await seedClosedTradeWithPrices();
    await calculatePnlForTrade(TRADE_ID);
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "LEARNING_RECORD_CREATED"));
    assert.ok(events.some((e) => e.type === "EVIDENCE_PROGRESS_UPDATED"));
    assert.ok(events.some((e) => e.type === "STRATEGY_HEALTH_UPDATED"));
    assert.ok(events.some((e) => e.type === "PORTFOLIO_RISK_EVALUATED"));
    assert.ok(events.some((e) => e.type === "SESSION_REPLAY_CREATED"));
    assert.ok(events.some((e) => e.type === "DAILY_BRIEFING_CREATED"));
    assert.ok(events.some((e) => e.type === "AUDIT_PACK_CREATED"));
  });

  it("update mission snapshot after PnL", async () => {
    await seedClosedTradeWithPrices();
    await calculatePnlForTrade(TRADE_ID);
    const mission = buildMissionSnapshot(await getEvents());
    assert.ok(mission.netPnl !== 0);
    assert.ok(mission.win >= 1 || mission.breakeven >= 1);
  });

  it("learning requires closed trade and realized PnL", async () => {
    await seedClosedTradeWithPrices();
    const blocked = await createLearningRecord({ tradeId: TRADE_ID });
    assert.equal(blocked.ok, false);
    await calculatePnlForTrade(TRADE_ID);
    const ok = await createLearningRecord({ tradeId: TRADE_ID });
    assert.equal(ok.ok, true);
    assert.ok((await getEvents()).some((e) => e.type === "LEARNING_RECORD_CREATED"));
  });

  it("learning blocks missing tradeId", async () => {
    const r = await createLearningRecord({ tradeId: "" });
    assert.equal(r.ok, false);
  });

  it("evidence progress caps at 12", async () => {
    const progress = await getEvidenceProgressView();
    assert.equal(progress.required, 12);
    assert.ok(progress.valid <= 12);
  });

  it("engine health zero-state OK", async () => {
    const health = await runEngineHealthCheck();
    assert.equal(health.status, "OK");
  });

  it("strategy health advisory only", async () => {
    const health = await buildStrategyHealthView();
    assert.equal(health.advisoryOnly, true);
    assert.equal(health.liveLocked, true);
  });

  it("mirofish swarm creates report without orders", async () => {
    const result = await runMirofishSwarm();
    assert.equal(result.ok, true);
    assert.ok(result.report);
    const events = await getEvents();
    assert.equal(events.some((e) => e.type === "ORDER_EXECUTED"), false);
    assert.equal(events.some((e) => e.type === "PREVIEW_CREATED"), false);
    assert.ok(events.some((e) => e.type === "MIROFISH_SCENARIO_REPORT_CREATED"));
  });

  it("live trading remains locked", () => {
    assert.equal(isLiveEnabled(), false);
  });
});
