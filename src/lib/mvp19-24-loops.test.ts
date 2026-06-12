import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { runAnalysis } from "@/lib/analysis/analysis-runner";
import { createDailyBriefing } from "@/lib/briefing/daily-briefing";
import { createSessionReplay } from "@/lib/replay/session-replay";
import { executeTestnetOrder } from "@/lib/execution/execute-testnet-order";
import { createTestnetPreview } from "@/lib/execution/create-preview";
import { reviewExecutionSafety } from "@/lib/execution/execution-safety-gate";
import {
  createManualNote,
  disableKillSwitch,
  enableKillSwitch,
  pauseEngine,
  setRiskMode,
} from "@/lib/operator/operator-actions";
import { getKillSwitchState, setKillSwitchCache } from "@/lib/operator/kill-switch";
import { evaluatePortfolioRisk, buildPortfolioRiskView, isPortfolioRiskBlocking } from "@/lib/portfolio-risk/portfolio-risk-manager";
import { evaluateMicroLiveReadiness } from "@/lib/live-readiness/readiness-evaluator";
import { runLiveDryRun } from "@/lib/live-sandbox/live-dry-run";
import { generateAuditPack } from "@/lib/audit/audit-pack-generator";
import { runSecurityCheck } from "@/lib/security/security-check";
import { runProductionHealthCheck } from "@/lib/production/production-health-check";
import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { isLiveEnabled } from "@/lib/risk/risk-gate";
import { redactSecrets } from "@/lib/security/security-check";

describe("MVP 19-24 loops", () => {
  let tmpDir: string;
  let prevDir: string | undefined;
  let prevTestnet: string | undefined;
  let prevMock: string | undefined;
  let prevKill: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v2-mvp19-"));
    prevDir = process.env.JOURNAL_DATA_DIR;
    prevTestnet = process.env.BINANCE_TESTNET_ENABLED;
    prevMock = process.env.V2_MVP2_MOCK_TRADE;
    prevKill = process.env.KILL_SWITCH_ACTIVE;
    process.env.JOURNAL_DATA_DIR = tmpDir;
    process.env.BINANCE_LIVE_ENABLED = "false";
    process.env.BINANCE_TESTNET_ENABLED = "true";
    process.env.V2_MVP2_MOCK_TRADE = "true";
    delete process.env.KILL_SWITCH_ACTIVE;
  });

  afterEach(() => {
    if (prevDir !== undefined) process.env.JOURNAL_DATA_DIR = prevDir;
    else delete process.env.JOURNAL_DATA_DIR;
    if (prevTestnet !== undefined) process.env.BINANCE_TESTNET_ENABLED = prevTestnet;
    if (prevMock !== undefined) process.env.V2_MVP2_MOCK_TRADE = prevMock;
    if (prevKill !== undefined) process.env.KILL_SWITCH_ACTIVE = prevKill;
    else delete process.env.KILL_SWITCH_ACTIVE;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("enable kill switch blocks execution", async () => {
    await enableKillSwitch({ reason: "Test block", doubleConfirm: true });
    assert.equal(getKillSwitchState().active, true);
    const preview = await createTestnetPreview({ runId: "r1", decisionLogId: "d1" });
    assert.equal(preview.ok, false);
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "KILL_SWITCH_ENABLED"));
  });

  it("kill switch blocks preview after stale cache", async () => {
    await enableKillSwitch({ reason: "Journal on", doubleConfirm: true });
    setKillSwitchCache({ active: false, reason: null });
    const preview = await createTestnetPreview({ runId: "r-stale", decisionLogId: "d-stale" });
    assert.equal(preview.ok, false);
  });

  it("enable kill switch requires double confirm", async () => {
    await disableKillSwitch({ doubleConfirm: true });
    const result = await enableKillSwitch({ reason: "No confirm", doubleConfirm: false });
    assert.equal(result.ok, false);
    assert.equal(getKillSwitchState().active, false);
  });

  it("engine pause blocks preview", async () => {
    await pauseEngine({ reason: "Maintenance", doubleConfirm: true });
    const preview = await createTestnetPreview({ runId: "r-pause", decisionLogId: "d-pause" });
    assert.equal(preview.ok, false);
  });

  it("portfolio risk blocks execution eligibility", async () => {
    for (let i = 0; i < 3; i++) {
      await appendEvent({
        type: "PNL_REALIZED",
        environment: "testnet",
        tradeId: `block-${i}`,
        payload: { result: "LOSS", netPnl: -10 },
      });
    }
    const report = await buildPortfolioRiskView();
    const consecutive = report.issues.find((i) => i.code === "CONSECUTIVE_LOSSES");
    assert.ok(consecutive);
    assert.equal(consecutive?.severity, "WARNING");
  });

  it("cooldown skipped during evidence collection after consecutive losses", async () => {
    for (let i = 0; i < 3; i++) {
      await appendEvent({
        type: "PNL_REALIZED",
        environment: "testnet",
        tradeId: `cd-${i}`,
        payload: { result: "LOSS", netPnl: -1 },
      });
    }
    await evaluatePortfolioRisk();
    const report = await buildPortfolioRiskView();
    assert.equal(report.cooldownUntil, null);
  });

  it("security check runs and writes event", async () => {
    const result = await runSecurityCheck();
    assert.equal(result.secretsRedacted, true);
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "SECURITY_CHECK_COMPLETED"));
  });

  it("disable kill switch writes event", async () => {
    await enableKillSwitch({ reason: "Test", doubleConfirm: true });
    await disableKillSwitch({ doubleConfirm: true });
    assert.equal(getKillSwitchState().active, false);
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "KILL_SWITCH_DISABLED"));
  });

  it("risk mode change writes event", async () => {
    await setRiskMode({ mode: "CONSERVATIVE", doubleConfirm: true });
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "RISK_MODE_CHANGED"));
  });

  it("manual note appears in analysis context", async () => {
    await createManualNote({ text: "Wait for volatility to settle." });
    const result = await runAnalysis();
    assert.ok(result.verdict.reasons.some((r) => r.includes("Operator note")));
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "MANUAL_NOTE_CREATED"));
  });

  it("briefing from zero-state", async () => {
    const briefing = await createDailyBriefing();
    assert.equal(briefing.liveLocked, true);
    assert.ok(briefing.nextRecommendedAction);
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "DAILY_BRIEFING_CREATED"));
  });

  it("replay closed trade lifecycle", async () => {
    const tradeId = "trade-replay";
    await appendEvent({
      type: "ANALYSIS_STARTED",
      environment: "testnet",
      runId: "run-r",
      decisionLogId: "dl-r",
      payload: {},
    });
    await appendEvent({
      type: "VERDICT_CREATED",
      environment: "testnet",
      runId: "run-r",
      decisionLogId: "dl-r",
      payload: { verdict: "TRADE", confidence: 60, reasons: [] },
    });
    await appendEvent({
      type: "ORDER_EXECUTED",
      environment: "testnet",
      runId: "run-r",
      decisionLogId: "dl-r",
      tradeId,
      payload: { symbol: "BTCUSDT", side: "SELL", qty: "0.001" },
    });
    await appendEvent({
      type: "POSITION_CLOSED",
      environment: "testnet",
      tradeId,
      payload: {},
    });
    const replay = await createSessionReplay(tradeId);
    assert.ok(replay.steps.length >= 2);
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "SESSION_REPLAY_CREATED"));
    assert.equal(events.some((e) => e.type === "ORDER_EXECUTED"), true);
  });

  it("daily loss blocks portfolio risk", async () => {
    for (let i = 0; i < 3; i++) {
      await appendEvent({
        type: "PNL_REALIZED",
        environment: "testnet",
        tradeId: `t${i}`,
        payload: { result: "LOSS", netPnl: -10 },
      });
    }
    const report = await buildPortfolioRiskView();
    assert.equal(report.blocksExecution, true);
  });

  it("micro-live not ready with missing evidence", async () => {
    const report = await evaluateMicroLiveReadiness();
    assert.equal(report.recommendation, "NOT_READY");
    assert.ok(report.gaps.length > 0);
  });

  it("live dry-run cannot send order", async () => {
    const dryRun = await runLiveDryRun();
    assert.equal(dryRun.simulatedOrder, null);
    assert.equal(dryRun.liveLocked, true);
    const events = await getEvents();
    assert.equal(events.some((e) => e.type === "ORDER_EXECUTED"), false);
  });

  it("audit pack generated with lifecycle evidence", async () => {
    await appendEvent({
      type: "POSITION_CLOSED",
      environment: "testnet",
      tradeId: "t-audit",
      payload: {},
    });
    const pack = await generateAuditPack();
    assert.ok(pack.sections.some((s) => s.name === "trade_lifecycle"));
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "AUDIT_PACK_CREATED"));
  });

  it("secrets are redacted", () => {
    const redacted = redactSecrets({ apiSecret: "super-secret", ok: true }) as Record<string, unknown>;
    assert.equal(redacted.apiSecret, "[REDACTED]");
    assert.equal(redacted.ok, true);
  });

  it("production health check runs", async () => {
    const health = await runProductionHealthCheck();
    assert.ok(["OK", "WARNING", "CRITICAL"].includes(health.status));
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "PRODUCTION_HEALTH_CHECKED"));
  });

  it("no live trading enabled", () => {
    assert.equal(isLiveEnabled(), false);
  });
});
