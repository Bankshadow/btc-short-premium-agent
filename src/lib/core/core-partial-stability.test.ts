import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { evaluateCoreHealth } from "./core-health";
import { aggregateHealthWarnings } from "./health-warning-aggregate";
import { runProjectionParityCheck } from "./projection-parity";
import { runUiConsistencyCheck } from "./ui-consistency-check";
import {
  applyTradeReconciliation,
  hasCloseEventForTrade,
  isFlatPosition,
  reconcileOpenTrade,
} from "./trade-reconciliation";
import { validateTradeEvidence } from "@/lib/evidence/evidence-validator";
import { appendEvent } from "@/lib/journal/journal-query";
import { isLiveEnabled } from "@/lib/risk/risk-gate";
import type { JournalEvent } from "@/lib/journal/journal-types";
import type { PositionSnapshot } from "@/lib/positions/position-types";
import type { OpenTrade } from "@/lib/trades/trade-types";
import { buildClosedTradesFromEvents } from "@/lib/trades/trade-store";
import { CORE_CHECK_BOUND_MS } from "./core-bounded";

function flatSnapshot(tradeId: string): PositionSnapshot {
  return {
    positionId: `pos-${tradeId}`,
    tradeId,
    previewId: "p1",
    runId: "r1",
    decisionLogId: "d1",
    environment: "TESTNET",
    symbol: "BTCUSDT",
    side: "SHORT",
    qty: "0.0000",
    entryPrice: null,
    markPrice: null,
    notionalUsd: null,
    unrealizedPnl: null,
    unrealizedPnlPct: null,
    leverage: null,
    source: "BINANCE_TESTNET",
    refreshedAt: new Date().toISOString(),
    status: "FLAT",
  };
}

function openTrade(tradeId: string): OpenTrade {
  return {
    tradeId,
    previewId: "p1",
    runId: "r1",
    decisionLogId: "d1",
    environment: "TESTNET",
    symbol: "BTCUSDT",
    side: "SELL",
    qty: "0.0000",
    notionalUsd: 100,
    orderId: "o1",
    clientOrderId: "c1",
    entryPrice: null,
    status: "OPEN",
    openedAt: new Date().toISOString(),
    source: "BINANCE_TESTNET",
    strategyVersionId: null,
  };
}

describe("Core partial stability fix", () => {
  let tmpDir: string;
  let prevDir: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "core-stability-"));
    prevDir = process.env.JOURNAL_DATA_DIR;
    process.env.JOURNAL_DATA_DIR = tmpDir;
  });

  afterEach(() => {
    if (prevDir !== undefined) process.env.JOURNAL_DATA_DIR = prevDir;
    else delete process.env.JOURNAL_DATA_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("ui-consistency returns within timeout", async () => {
    const start = Date.now();
    const report = await runUiConsistencyCheck();
    const elapsed = Date.now() - start;
    assert.ok(elapsed < CORE_CHECK_BOUND_MS + 500);
    assert.ok(["OK", "WARNING", "BLOCKED"].includes(report.status));
    assert.ok(report.lastCheckedAt);
  });

  it("ui-consistency returns partial result when some checks unavailable", async () => {
    const report = await runUiConsistencyCheck();
    assert.ok(report.skippedChecks.length > 0);
    const skipped = report.checks.filter((c) => c.skipped);
    assert.ok(skipped.length > 0);
    assert.equal(skipped.some((c) => c.id === "binance_status"), true);
  });

  it("projection-parity returns within timeout", async () => {
    const start = Date.now();
    const report = await runProjectionParityCheck();
    const elapsed = Date.now() - start;
    assert.ok(elapsed < CORE_CHECK_BOUND_MS + 500);
    assert.ok(["OK", "WARNING", "BLOCKED"].includes(report.status));
    assert.equal(typeof report.eventCount, "number");
  });

  it("projection-parity returns partial result instead of timeout", async () => {
    const report = await runProjectionParityCheck();
    assert.ok(report.skippedChecks.includes("reports_summary"));
    assert.ok(report.checkedSections.length >= 0);
    assert.ok(report.parityIssues !== undefined);
  });

  it("OPEN trade + FLAT position derives CLOSED_PENDING_PNL when close exists", () => {
    const tradeId = "stale-close-trade";
    const events: JournalEvent[] = [
      {
        eventId: "e1",
        timestamp: new Date().toISOString(),
        type: "CLOSE_ORDER_EXECUTED",
        environment: "testnet",
        tradeId,
        payload: {},
      },
    ];
    const result = reconcileOpenTrade(openTrade(tradeId), flatSnapshot(tradeId), events);
    assert.equal(result.projectedStatus, "CLOSED_PENDING_PNL");
    assert.equal(result.countsAsOpen, false);
    assert.ok(result.warnings.includes("LOCAL_OPEN_TRADE_BUT_EXCHANGE_FLAT"));
  });

  it("OPEN trade + FLAT position derives RECONCILIATION_REQUIRED without close", () => {
    const tradeId = "stale-no-close";
    const result = reconcileOpenTrade(openTrade(tradeId), flatSnapshot(tradeId), []);
    assert.equal(result.projectedStatus, "RECONCILIATION_REQUIRED");
    assert.equal(result.recommendation, "MANUAL_REPAIR_REQUIRED");
    assert.equal(result.countsAsOpen, false);
  });

  it("applyTradeReconciliation excludes stale open from effectiveOpenCount", async () => {
    const tradeId = "recon-trade";
    await appendEvent({
      type: "ORDER_EXECUTED",
      environment: "testnet",
      tradeId,
      previewId: "pv",
      payload: { symbol: "BTCUSDT", side: "SELL", qty: "0", orderId: "1" },
    });
    await appendEvent({
      type: "POSITION_OPENED",
      environment: "testnet",
      tradeId,
      payload: { qty: "0", entryPrice: null },
    });
    await appendEvent({
      type: "POSITION_MONITORED",
      environment: "testnet",
      tradeId,
      payload: {
        ...flatSnapshot(tradeId),
        status: "FLAT",
        qty: "0.0000",
      },
    });

    const { readCoreEvents } = await import("@/lib/core/event-store");
    const allEvents = await readCoreEvents();
    const reconciled = applyTradeReconciliation(allEvents);
    assert.equal(reconciled.effectiveOpenCount, 0);
    assert.ok(reconciled.staleOpenWarnings.length >= 1);
  });

  it("health warnings are aggregated", async () => {
    const raw = [
      { code: "SKIPPED_LIFECYCLE_STEP", message: "skip a", severity: "WARNING" as const, tradeId: "t1" },
      { code: "SKIPPED_LIFECYCLE_STEP", message: "skip b", severity: "WARNING" as const, tradeId: "t2" },
      { code: "SKIPPED_LIFECYCLE_STEP", message: "skip c", severity: "WARNING" as const, tradeId: "t1" },
    ];
    const aggregated = aggregateHealthWarnings(raw);
    assert.equal(aggregated.length, 1);
    assert.equal(aggregated[0].count, 3);
    assert.deepEqual([...aggregated[0].affectedTradeIds].sort(), ["t1", "t2"]);
    assert.equal(aggregated[0].examples.length, 3);
  });

  it("evaluateCoreHealth returns aggregated warnings not raw flood", async () => {
    await appendEvent({
      type: "ORDER_EXECUTED",
      environment: "testnet",
      tradeId: "life-1",
      previewId: "p",
      payload: { symbol: "BTCUSDT", side: "SELL", qty: "0.001", orderId: "1" },
    });
    await appendEvent({
      type: "POSITION_CLOSED",
      environment: "testnet",
      tradeId: "life-1",
      payload: {},
    });

    const health = await evaluateCoreHealth();
    assert.ok(health.warnings.length <= health.rawWarningCount);
    if (health.warnings.length > 0) {
      assert.equal(typeof health.warnings[0].count, "number");
      assert.ok(Array.isArray(health.warnings[0].affectedTradeIds));
    }
  });

  it("evidence rejection reasons are deduped", async () => {
    await appendEvent({
      type: "POSITION_CLOSED",
      environment: "testnet",
      tradeId: "ev-trade",
      payload: {},
    });
    const events = await (await import("@/lib/journal/journal-query")).getEvents();
    const result = validateTradeEvidence("ev-trade", events);
    const pnlReasons = result.rejectionReasons.filter((r) => r === "MISSING_PNL_REALIZED");
    assert.equal(pnlReasons.length, 1);
    assert.equal(result.status, "REJECTED");
  });

  it("closed pending PnL does not create fake PNL_REALIZED", async () => {
    await appendEvent({
      type: "ORDER_EXECUTED",
      environment: "testnet",
      tradeId: "pending-pnl",
      previewId: "p",
      payload: { symbol: "BTCUSDT", side: "SELL", qty: "0.001", orderId: "1" },
    });
    await appendEvent({
      type: "POSITION_CLOSED",
      environment: "testnet",
      tradeId: "pending-pnl",
      payload: { realizedPnlPending: true },
    });
    const events = await (await import("@/lib/journal/journal-query")).getEvents();
    const closed = buildClosedTradesFromEvents(events);
    assert.equal(closed[0].status, "CLOSED_PENDING_PNL");
    assert.equal(closed[0].result, "PENDING_PNL");
    assert.equal(closed[0].pnlStatus, "PENDING_DATA");
    assert.equal(closed[0].netPnl, 0);
    assert.equal(events.some((e) => e.type === "PNL_REALIZED"), false);
  });

  it("no live trading enabled", () => {
    assert.equal(isLiveEnabled(), false);
  });

  it("health API shape does not expose secrets", async () => {
    const health = await evaluateCoreHealth();
    const serialized = JSON.stringify(health);
    assert.equal(serialized.includes("apiSecret"), false);
    assert.equal(serialized.includes("BINANCE_API"), false);
  });

  it("isFlatPosition detects FLAT and zero qty", () => {
    assert.equal(isFlatPosition(flatSnapshot("t")), true);
    assert.equal(isFlatPosition({ ...flatSnapshot("t"), status: "OPEN", qty: "0" }), true);
    assert.equal(isFlatPosition(null), false);
  });

  it("hasCloseEventForTrade detects close order and position closed", () => {
    const events: JournalEvent[] = [
      {
        eventId: "e",
        timestamp: new Date().toISOString(),
        type: "CLOSE_ORDER_EXECUTED",
        environment: "testnet",
        tradeId: "x",
        payload: {},
      },
    ];
    assert.equal(hasCloseEventForTrade(events, "x"), true);
    assert.equal(hasCloseEventForTrade(events, "y"), false);
  });
});
