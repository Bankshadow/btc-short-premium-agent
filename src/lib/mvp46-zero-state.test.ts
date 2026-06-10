import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { runAnalysis } from "@/lib/analysis/analysis-runner";
import { computeReadyForMvp5, MVP5_NOT_READY_MESSAGE } from "@/lib/core/mvp5-readiness";
import {
  zeroMissionSnapshotView,
  zeroReportsSummary,
} from "@/lib/core/zero-state";
import { withTimeout, OperationTimeoutError } from "@/lib/core/with-timeout";
import {
  DEFAULT_BINANCE_FUTURES_TESTNET_BASE_URL,
  resolveTestnetBaseUrl,
} from "@/lib/execution/binance-testnet-config";
import { normalizeBinanceStatusDiagnostics } from "@/lib/execution/binance-status-diagnostics";
import {
  getBinanceTestnetStatus,
  getBinanceTestnetStatusBounded,
} from "@/lib/execution/binance-testnet-status";
import { buildMissionSnapshotView } from "@/lib/mission/build-mission-snapshot-view";
import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { buildReportsSummary } from "@/lib/reports/build-reports-summary";
import { isLiveEnabled } from "@/lib/risk/risk-gate";

describe("MVP 4.6 zero-state and config gate", () => {
  let tmpDir: string;
  let prevDir: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v2-mvp46-"));
    prevDir = process.env.JOURNAL_DATA_DIR;
    process.env.JOURNAL_DATA_DIR = tmpDir;
    process.env.BINANCE_TESTNET_ENABLED = "true";
    process.env.BINANCE_LIVE_ENABLED = "false";
    delete process.env.BINANCE_API_KEY;
    delete process.env.BINANCE_API_SECRET;
  });

  afterEach(() => {
    if (prevDir !== undefined) process.env.JOURNAL_DATA_DIR = prevDir;
    else delete process.env.JOURNAL_DATA_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("zero mission snapshot view has consistent defaults", () => {
    const view = zeroMissionSnapshotView({
      ready: false,
      message: MVP5_NOT_READY_MESSAGE,
      reasons: ["test"],
    });
    assert.equal(view.currentEquity, 1000);
    assert.equal(view.targetCapital, 10000);
    assert.equal(view.progressPct, 0);
    assert.equal(view.totalTrades, 0);
    assert.equal(view.openPositions, 0);
    assert.equal(view.win, 0);
    assert.equal(view.loss, 0);
    assert.equal(view.netPnl, 0);
    assert.equal(view.latestRunId, null);
    assert.equal(view.latestDecisionLogId, null);
    assert.equal(view.latestPreview, null);
    assert.equal(view.binanceStatus?.baseUrl, DEFAULT_BINANCE_FUTURES_TESTNET_BASE_URL);
    assert.match(view.nextAction ?? "", /Configure Binance|run first AI/i);
  });

  it("binance status always includes baseUrl default", async () => {
    const status = await getBinanceTestnetStatus();
    assert.equal(status.baseUrl, DEFAULT_BINANCE_FUTURES_TESTNET_BASE_URL);
    const normalized = normalizeBinanceStatusDiagnostics(status);
    assert.ok(normalized.baseUrl.length > 0);
    assert.notEqual(normalized.baseUrl, "—");
  });

  it("resolveTestnetBaseUrl defaults when env missing", () => {
    delete process.env.BINANCE_FUTURES_TESTNET_BASE_URL;
    assert.equal(resolveTestnetBaseUrl(), DEFAULT_BINANCE_FUTURES_TESTNET_BASE_URL);
  });

  it("getBinanceTestnetStatusBounded returns within timeout", async () => {
    const start = Date.now();
    const status = await getBinanceTestnetStatusBounded(5000);
    assert.ok(Date.now() - start < 6000);
    assert.ok(status.baseUrl.length > 0);
  });

  it("withTimeout rejects slow operations", async () => {
    await assert.rejects(
      () =>
        withTimeout(
          "slow",
          new Promise((resolve) => setTimeout(resolve, 200)),
          20,
        ),
      OperationTimeoutError,
    );
  });

  it("buildMissionSnapshotView returns zero-state without hanging", async () => {
    const start = Date.now();
    const view = await buildMissionSnapshotView();
    assert.ok(Date.now() - start < 6000);
    assert.equal(view.currentEquity, 1000);
    assert.equal(view.readyForMvp5, false);
    assert.equal(view.readyForMvp5Message, MVP5_NOT_READY_MESSAGE);
  });

  it("buildReportsSummary returns zero-state shape", async () => {
    const summary = await buildReportsSummary();
    assert.equal(summary.mission.currentEquity, 1000);
    assert.equal(summary.readyForMvp5, false);
    assert.equal(summary.binanceStatus.baseUrl, DEFAULT_BINANCE_FUTURES_TESTNET_BASE_URL);
  });

  it("readyForMvp5 false until open trade and events exist", async () => {
    const events = await getEvents();
    let readiness = computeReadyForMvp5({
      binanceStatus: { status: "MISSING_ENV" } as never,
      events,
      openTradeCount: 0,
    });
    assert.equal(readiness.ready, false);
    assert.equal(readiness.message, MVP5_NOT_READY_MESSAGE);

    await appendEvent({
      type: "ORDER_EXECUTED",
      environment: "testnet",
      runId: "run-1",
      decisionLogId: "dl-1",
      tradeId: "trade-1",
      payload: { symbol: "BTCUSDT", side: "SELL", qty: "0.001" },
    });
    await appendEvent({
      type: "POSITION_OPENED",
      environment: "testnet",
      runId: "run-1",
      decisionLogId: "dl-1",
      tradeId: "trade-1",
      payload: { symbol: "BTCUSDT", side: "SELL", qty: "0.001" },
    });

    readiness = computeReadyForMvp5({
      binanceStatus: { status: "CONNECTED" } as never,
      events: await getEvents(),
      openTradeCount: 1,
    });
    assert.equal(readiness.ready, true);
  });

  it("Start AI creates runId decisionLogId and journal events when Binance missing", async () => {
    const result = await runAnalysis();
    assert.ok(result.runId);
    assert.ok(result.decisionLogId);
    assert.equal(result.verdict.verdict, "BLOCKED");
    assert.ok(
      result.verdict.reasons.some((r) => r.toLowerCase().includes("binance testnet not configured")),
    );

    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "ANALYSIS_STARTED" && e.runId === result.runId));
    assert.ok(events.some((e) => e.type === "VERDICT_CREATED" && e.decisionLogId === result.decisionLogId));
    assert.ok(events.some((e) => e.type === "MISSION_SNAPSHOT_UPDATED"));
  });

  it("live trading remains locked", () => {
    assert.equal(isLiveEnabled(), false);
  });

  it("zero reports summary includes readyForMvp5 false", () => {
    const summary = zeroReportsSummary({
      ready: false,
      message: MVP5_NOT_READY_MESSAGE,
      reasons: [],
    });
    assert.equal(summary.evidenceProgress.valid, 0);
    assert.equal(summary.evidenceProgress.required, 12);
    assert.equal(summary.readyForMvp5, false);
  });
});
