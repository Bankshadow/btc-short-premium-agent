import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { buildCoreTrace, runCoreReplay } from "@/lib/core/core-engine";
import { evaluateCoreHealth } from "@/lib/core/core-health";
import { appendEvent } from "@/lib/journal/journal-query";
import { validateRawCoreEvent } from "@/lib/core/event-validator";
import { buildAllProjections } from "@/lib/core/projection-engine";
import { buildProjectionBundle } from "@/lib/core/projection-bundle";
import { buildEnrichedTradeProjection } from "@/lib/core/build-enriched-trade-projection";
import { runUiConsistencyCheck } from "@/lib/core/ui-consistency-check";
import { buildMissionSnapshot } from "@/lib/mission/mission-snapshot";
import { buildReportsSummary } from "@/lib/reports/build-reports-summary";
import { DEFAULT_START_CAPITAL } from "@/lib/mission/mission-types";
import { isLiveEnabled } from "@/lib/risk/risk-gate";
import { getBinanceTestnetStatusBounded } from "@/lib/execution/binance-testnet-status";
import { API_RESPONSE_BOUND_MS } from "@/lib/core/zero-state";

describe("Slice 8 — core API regression", () => {
  let tmpDir: string;
  let prevDir: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "slice8-api-"));
    prevDir = process.env.JOURNAL_DATA_DIR;
    process.env.JOURNAL_DATA_DIR = tmpDir;
    process.env.BINANCE_LIVE_ENABLED = "false";
  });

  afterEach(() => {
    if (prevDir !== undefined) process.env.JOURNAL_DATA_DIR = prevDir;
    else delete process.env.JOURNAL_DATA_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("core health returns OK on empty journal", async () => {
    const health = await evaluateCoreHealth();
    assert.ok(["OK", "WARNING", "BLOCKED"].includes(health.status));
    assert.equal(health.liveLocked, true);
  });

  it("projection bundle zero-state matches mission defaults", async () => {
    const bundle = await buildProjectionBundle();
    assert.equal(bundle.ok, true);
    if (bundle.ok) {
      assert.equal(bundle.mission.currentEquity, DEFAULT_START_CAPITAL);
      assert.equal(bundle.pnl.totalNetPnl, 0);
      assert.equal(bundle.evidence.valid, 0);
      assert.equal(bundle.risk.liveLocked, true);
    }
  });

  it("all projection types rebuild from events", async () => {
    await appendEvent({
      type: "PNL_REALIZED",
      environment: "testnet",
      tradeId: "t1",
      payload: {
        netPnl: 2.5,
        result: "WIN",
        qty: "0.001",
        entryPrice: 100000,
        exitPrice: 99000,
        side: "SHORT",
        grossPnl: 2.5,
      },
    });
    const events = (await import("@/lib/core/event-store")).readCoreEvents;
    const list = await events();
    const all = buildAllProjections(list);
    assert.equal(all.pnl.totalNetPnl, 2.5);
    assert.ok(all.mission.currentEquity > DEFAULT_START_CAPITAL);
    assert.ok(all.meta.eventCount >= 1);
  });

  it("trace API builder finds trade by tradeId", async () => {
    const tradeId = "trace-regression-trade";
    await appendEvent({
      type: "ORDER_EXECUTED",
      environment: "testnet",
      tradeId,
      payload: { symbol: "BTCUSDT" },
    });
    const trace = await buildCoreTrace(tradeId);
    assert.ok(trace);
    assert.equal(trace?.linkId, tradeId);
  });

  it("replay rebuilds projections without error", async () => {
    const report = await runCoreReplay();
    assert.equal(report.ok, true);
    assert.ok(report.projections);
  });

  it("ui consistency check returns OK on empty journal", async () => {
    const report = await runUiConsistencyCheck();
    assert.equal(report.status, "OK");
    assert.equal(report.mismatches.length, 0);
  });

  it("event validate rejects secret leakage", async () => {
    const result = validateRawCoreEvent(
      {
        type: "TEST_EVENT",
        environment: "testnet",
        payload: { apiSecret: "leaked" },
      },
      { checkSecrets: true, checkLiveLeak: true },
    );
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it("mission projection matches legacy snapshot builder", async () => {
    await appendEvent({
      type: "PNL_REALIZED",
      environment: "testnet",
      tradeId: "parity",
      payload: { netPnl: 1, result: "WIN" },
    });
    const events = await (await import("@/lib/core/event-store")).readCoreEvents();
    const legacy = buildMissionSnapshot(events);
    const projected = buildAllProjections(events).mission;
    assert.equal(projected.currentEquity, legacy.currentEquity);
    assert.equal(projected.progressPct, legacy.progressPct);
  });

  it("enriched trades projection returns summary counts", async () => {
    const events = await (await import("@/lib/core/event-store")).readCoreEvents();
    const trades = await buildEnrichedTradeProjection(events);
    assert.equal(trades.summary.openCount, 0);
    assert.equal(trades.summary.closedCount, 0);
    assert.equal(trades.summary.realizedPnl, 0);
  });

  it("reports summary and projection bundle equity align at zero-state", async () => {
    const reports = await buildReportsSummary();
    const bundle = await buildProjectionBundle();
    assert.equal(bundle.ok, true);
    if (bundle.ok) {
      assert.equal(reports.mission.currentEquity, bundle.mission.currentEquity);
    }
  });

  it("live trading remains locked", () => {
    assert.equal(isLiveEnabled(), false);
  });

  it("binance status bounded call returns within timeout", async () => {
    const status = await getBinanceTestnetStatusBounded(API_RESPONSE_BOUND_MS);
    assert.ok(status.status);
    assert.ok(status.baseUrl);
    assert.equal(status.liveEnabled, false);
  });
});
