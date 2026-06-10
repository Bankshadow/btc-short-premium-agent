import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { runMirofishSwarm } from "@/lib/skills/mirofish-swarm/swarm-runner";
import { runCollaborationLoop } from "@/lib/collaboration/collaboration-runner";
import { isLiveEnabled } from "@/lib/risk/risk-gate";
import { evaluateCoreHealth } from "@/lib/core/core-health";
import { appendCoreEventStrict } from "@/lib/core/event-store";
import { buildAllProjections } from "@/lib/core/projection-engine";
import { replayJournalProjections } from "@/lib/core/event-replay";
import { deriveTradeLifecycleState } from "@/lib/core/lifecycle-state-machine";
import { buildTraceReport } from "@/lib/core/trace/trace-builder";
import { validateBeforeAppend, validateEventEnvelope } from "@/lib/core/event-validator";
import { checkLiveLockGuard } from "@/lib/core/guards/live-lock-guard";

const TRADE_ID = "trade-core-test";
const RUN_ID = "run-core-test";
const DL_ID = "dl-core-test";
const PREVIEW_ID = "preview-core-test";

describe("Core engine", () => {
  let tmpDir: string;
  let prevDir: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v2-core-engine-"));
    prevDir = process.env.JOURNAL_DATA_DIR;
    process.env.JOURNAL_DATA_DIR = tmpDir;
    process.env.BINANCE_LIVE_ENABLED = "false";
  });

  afterEach(() => {
    if (prevDir !== undefined) process.env.JOURNAL_DATA_DIR = prevDir;
    else delete process.env.JOURNAL_DATA_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("valid event envelope accepted", () => {
    const result = validateEventEnvelope({
      type: "ANALYSIS_STARTED",
      environment: "testnet",
      runId: RUN_ID,
      decisionLogId: DL_ID,
      payload: { trigger: "manual" },
    });
    assert.equal(result.valid, true);
  });

  it("invalid event missing environment rejected", () => {
    const result = validateEventEnvelope({
      type: "ANALYSIS_STARTED",
      environment: "" as "testnet",
      payload: {},
    });
    assert.equal(result.valid, false);
  });

  it("secret leakage rejected", () => {
    const result = validateEventEnvelope({
      type: "ERROR_RECORDED",
      environment: "testnet",
      payload: { apiSecret: "super-secret-value-here" },
    });
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((i) => i.code === "SECRET_VALUE_REDACTABLE" || i.code === "SECRET_KEY_FORBIDDEN"));
  });

  it("live leakage detected", () => {
    const result = validateEventEnvelope({
      type: "ERROR_RECORDED",
      environment: "testnet",
      payload: { liveEnabled: true },
    });
    assert.equal(result.valid, false);
  });

  it("mission projection from zero-state", () => {
    const p = buildAllProjections([]);
    assert.equal(p.mission.currentEquity, 1000);
    assert.equal(p.trades.open.length, 0);
  });

  it("order executed without safety review fails lifecycle", async () => {
    await appendEvent({
      type: "ORDER_EXECUTED",
      environment: "testnet",
      runId: RUN_ID,
      decisionLogId: DL_ID,
      previewId: PREVIEW_ID,
      tradeId: TRADE_ID,
      payload: { side: "SELL", symbol: "BTCUSDT" },
    });
    const events = await getEvents();
    const life = deriveTradeLifecycleState(TRADE_ID, events);
    assert.ok(life.issues.some((i) => i.code === "ORDER_WITHOUT_SAFETY_REVIEW"));
  });

  it("valid trade lifecycle passes after full seed", async () => {
    await appendEvent({
      type: "EXECUTION_REVIEWED",
      environment: "testnet",
      runId: RUN_ID,
      decisionLogId: DL_ID,
      previewId: PREVIEW_ID,
      payload: { allowed: true, doubleConfirm: true },
    });
    await appendEvent({
      type: "ORDER_EXECUTED",
      environment: "testnet",
      runId: RUN_ID,
      decisionLogId: DL_ID,
      previewId: PREVIEW_ID,
      tradeId: TRADE_ID,
      payload: { side: "SELL", symbol: "BTCUSDT", avgPrice: 50000 },
    });
    await appendEvent({
      type: "CLOSE_ORDER_EXECUTED",
      environment: "testnet",
      tradeId: TRADE_ID,
      payload: { avgPrice: 49000 },
    });
    await appendEvent({
      type: "POSITION_CLOSED",
      environment: "testnet",
      tradeId: TRADE_ID,
      payload: {},
    });
    await appendEvent({
      type: "PNL_REALIZED",
      environment: "testnet",
      tradeId: TRADE_ID,
      payload: { netPnl: 1, result: "WIN" },
    });
    const events = await getEvents();
    const life = deriveTradeLifecycleState(TRADE_ID, events);
    assert.equal(life.state, "PNL_REALIZED");
    assert.equal(life.issues.filter((i) => i.severity === "BLOCK").length, 0);
  });

  it("PnL without position closed fails lifecycle", async () => {
    await appendEvent({
      type: "PNL_REALIZED",
      environment: "testnet",
      tradeId: "orphan-pnl",
      payload: { netPnl: 1 },
    });
    const events = await getEvents();
    const life = deriveTradeLifecycleState("orphan-pnl", events);
    assert.ok(life.issues.some((i) => i.code === "PNL_WITHOUT_CLOSE"));
  });

  it("learning without PnL fails lifecycle check on append simulation", async () => {
    await appendEvent({
      type: "POSITION_CLOSED",
      environment: "testnet",
      tradeId: TRADE_ID,
      payload: {},
    });
    const existing = await getEvents();
    const result = validateBeforeAppend(
      {
        type: "LEARNING_RECORD_CREATED",
        environment: "testnet",
        tradeId: TRADE_ID,
        payload: { tradeId: TRADE_ID },
      },
      existing,
      { checkLifecycle: true },
    );
    assert.ok(result.issues.some((i) => i.code === "LEARNING_WITHOUT_PNL"));
  });

  it("core health OK on zero-state", async () => {
    const health = await evaluateCoreHealth();
    assert.ok(["OK", "WARNING"].includes(health.status));
    assert.equal(health.liveLocked, true);
  });

  it("replay rebuilds projections", async () => {
    const report = await replayJournalProjections();
    assert.equal(report.eventCount, 0);
    assert.equal(report.projections.mission.currentEquity, 1000);
  });

  it("trace by tradeId", async () => {
    await appendEvent({
      type: "ORDER_EXECUTED",
      environment: "testnet",
      tradeId: TRADE_ID,
      previewId: PREVIEW_ID,
      payload: {},
    });
    const trace = buildTraceReport(await getEvents(), "tradeId", TRADE_ID);
    assert.equal(trace.linkId, TRADE_ID);
    assert.ok(trace.steps.length >= 1);
  });

  it("live locked", () => {
    assert.equal(isLiveEnabled(), false);
    assert.equal(checkLiveLockGuard().blocked, false);
  });

  it("mirofish swarm cannot execute", async () => {
    await runMirofishSwarm();
    const events = await getEvents();
    assert.equal(events.some((e) => e.type === "ORDER_EXECUTED"), false);
  });

  it("collaboration cannot execute", async () => {
    await runCollaborationLoop("run-collab-core");
    const events = await getEvents();
    assert.equal(events.some((e) => e.type === "ORDER_EXECUTED"), false);
  });

  it("strict append rejects live environment", async () => {
    await assert.rejects(
      appendCoreEventStrict({
        type: "ANALYSIS_STARTED",
        environment: "live" as "testnet",
        payload: {},
      }),
    );
  });
});
