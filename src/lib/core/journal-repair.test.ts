import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { validateTradeEvidence } from "@/lib/evidence/evidence-validator";
import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { runJournalRepair } from "@/lib/journal/journal-repair";
import { hasTradeChainEvent, resolveTradeChain } from "@/lib/journal/trade-chain";
import { calculatePnlForTrade } from "@/lib/pnl/calculate-pnl";

const TRADE_ID = "trade-repair-1";
const RUN_ID = "run-repair-1";
const DL_ID = "dl-repair-1";
const PREVIEW_ID = "prev-repair-1";

async function seedReconciliationClosedTrade() {
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
    payload: { verdict: "TRADE", confidence: 60 },
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
    payload: { symbol: "BTCUSDT", side: "SELL", qty: "0.0000", orderId: "1", status: "NEW" },
  });
  await appendEvent({
    type: "POSITION_OPENED",
    environment: "testnet",
    runId: RUN_ID,
    decisionLogId: DL_ID,
    tradeId: TRADE_ID,
    previewId: PREVIEW_ID,
    payload: { symbol: "BTCUSDT", side: "SELL", qty: "0.0000", entryPrice: null },
  });
  await appendEvent({
    type: "POSITION_MONITORED",
    environment: "testnet",
    runId: RUN_ID,
    decisionLogId: DL_ID,
    tradeId: TRADE_ID,
    previewId: PREVIEW_ID,
    payload: { status: "FLAT", qty: "0.0000" },
  });
  await appendEvent({
    type: "CLOSE_ORDER_EXECUTED",
    environment: "testnet",
    runId: RUN_ID,
    decisionLogId: DL_ID,
    tradeId: TRADE_ID,
    payload: {
      symbol: "BTCUSDT",
      side: "BUY",
      qty: "0.0000",
      avgPrice: 0,
      orderId: `reconcile-${TRADE_ID}`,
      source: "RECONCILIATION_BACKFILL",
    },
  });
  await appendEvent({
    type: "POSITION_CLOSED",
    environment: "testnet",
    runId: RUN_ID,
    decisionLogId: DL_ID,
    tradeId: TRADE_ID,
    payload: {
      symbol: "BTCUSDT",
      qty: "0.0000",
      source: "RECONCILIATION_BACKFILL",
      realizedPnlPending: true,
    },
  });
}

describe("journal repair", () => {
  let tmpDir: string;
  let prevDir: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v2-journal-repair-"));
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

  it("resolves run-scoped evidence events without tradeId", async () => {
    await seedReconciliationClosedTrade();
    const events = await getEvents();
    const chain = resolveTradeChain(TRADE_ID, events);
    assert.ok(chain?.runId === RUN_ID);
    assert.equal(hasTradeChainEvent("ANALYSIS_STARTED", TRADE_ID, events), true);
    assert.equal(hasTradeChainEvent("PREVIEW_CREATED", TRADE_ID, events), true);
    assert.equal(hasTradeChainEvent("EXECUTION_REVIEWED", TRADE_ID, events), true);
  });

  it("zero-fill reconciliation records breakeven PnL without fake prices", async () => {
    await seedReconciliationClosedTrade();
    const result = await calculatePnlForTrade(TRADE_ID);
    assert.equal(result.ok, true);
    assert.equal(result.record?.netPnl, 0);
    assert.equal(result.record?.result, "BREAKEVEN");
    const events = await getEvents();
    const pnl = events.find((e) => e.type === "PNL_REALIZED" && e.tradeId === TRADE_ID);
    assert.equal((pnl?.payload as { source?: string }).source, "ZERO_FILL_RECONCILIATION");
  });

  it("runJournalRepair backfills CLOSE_REVIEWED and post-trade loop", async () => {
    await seedReconciliationClosedTrade();
    const report = await runJournalRepair({ tradeIds: [TRADE_ID] });
    assert.equal(report.ok, true);
    assert.equal(report.trades[0]?.closeReviewedBackfill, "applied");
    assert.equal(report.trades[0]?.pnlRepair, "applied");
    assert.equal(report.trades[0]?.postTradeLoop, "applied");

    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "CLOSE_REVIEWED" && e.tradeId === TRADE_ID));
    assert.ok(events.some((e) => e.type === "LEARNING_RECORD_CREATED" && e.tradeId === TRADE_ID));

    const evidence = validateTradeEvidence(TRADE_ID, events);
    assert.equal(evidence.status, "VALID", evidence.rejectionReasons.join(", "));
  });

  it("pending priced trade without fill data stays PNL_PENDING", async () => {
    await appendEvent({
      type: "ORDER_EXECUTED",
      environment: "testnet",
      tradeId: "pending-priced",
      payload: { symbol: "BTCUSDT", side: "SELL", qty: "0.001", orderId: "1" },
    });
    await appendEvent({
      type: "POSITION_CLOSED",
      environment: "testnet",
      tradeId: "pending-priced",
      payload: { realizedPnlPending: true },
    });
    const result = await calculatePnlForTrade("pending-priced");
    assert.equal(result.ok, false);
    const events = await getEvents();
    assert.equal(events.some((e) => e.type === "PNL_REALIZED" && e.tradeId === "pending-priced"), false);
  });
});
