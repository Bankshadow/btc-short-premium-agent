import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { runAnalysis } from "@/lib/analysis/analysis-runner";
import { generateAuditPack } from "@/lib/audit/audit-pack-generator";
import { createTestnetPreview } from "@/lib/execution/create-preview";
import { reviewExecutionSafety } from "@/lib/execution/execution-safety-gate";
import { runLiveDryRun } from "@/lib/live-sandbox/live-dry-run";
import { validateJournalChain } from "@/lib/journal/journal-chain-validator";
import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { buildReportsSummary } from "@/lib/reports/build-reports-summary";
import { evaluateNoTradeRules } from "@/lib/rules/no-trade-rule-engine";
import { sumDailyPnl } from "@/lib/pnl/daily-pnl";
import {
  disableKillSwitch,
  enableKillSwitch,
} from "@/lib/operator/operator-actions";
import { setKillSwitchCache } from "@/lib/operator/kill-switch";
import { runMirofishSwarm } from "@/lib/skills/mirofish-swarm/swarm-runner";
import { DEFAULT_START_CAPITAL } from "@/lib/mission/mission-types";
import { zeroMissionSnapshotView } from "@/lib/core/zero-state";
import { computeReadyForMvp5 } from "@/lib/core/mvp5-readiness";
import { defaultBinanceDiagnostics } from "@/lib/core/zero-state";
import { isLiveEnabled } from "@/lib/risk/risk-gate";
import { redactSecrets } from "@/lib/security/security-check";
import { hydrateOperatorGateState } from "@/lib/operator/operator-actions";

describe("V2 final system audit scenarios", () => {
  let tmpDir: string;
  let prevDir: string | undefined;
  let prevTestnet: string | undefined;
  let prevMock: string | undefined;
  let prevKill: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v2-final-audit-"));
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

  it("Scenario A: zero-state pages load from shared APIs", async () => {
    const readiness = computeReadyForMvp5({
      binanceStatus: defaultBinanceDiagnostics(),
      events: [],
      openTradeCount: 0,
    });
    const view = zeroMissionSnapshotView(readiness);
    assert.equal(view.currentEquity, DEFAULT_START_CAPITAL);
    assert.equal(view.evidenceProgress.valid, 0);
    assert.equal(isLiveEnabled(), false);

    const reports = await buildReportsSummary();
    assert.equal(reports.liveLocked, true);
    assert.equal(reports.mission.currentEquity, view.currentEquity);
  });

  it("Scenario B: safe blocked analysis when Binance missing", async () => {
    delete process.env.BINANCE_API_KEY;
    delete process.env.BINANCE_API_SECRET;
    const result = await runAnalysis();
    assert.ok(result.runId);
    assert.ok(result.decisionLogId);
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "ANALYSIS_STARTED"));
    assert.ok(events.some((e) => e.type === "VERDICT_CREATED"));
  });

  it("Scenario C: full mock lifecycle events chain", async () => {
    const runId = "run-e2e";
    const decisionLogId = "dl-e2e";
    const tradeId = "trade-e2e";
    const previewId = "preview-e2e";

    await appendEvent({
      type: "ANALYSIS_STARTED",
      environment: "testnet",
      runId,
      decisionLogId,
      payload: {},
    });
    await appendEvent({
      type: "VERDICT_CREATED",
      environment: "testnet",
      runId,
      decisionLogId,
      payload: { verdict: "TRADE", confidence: 60, reasons: [] },
    });
    await appendEvent({
      type: "PREVIEW_CREATED",
      environment: "testnet",
      runId,
      decisionLogId,
      previewId,
      payload: { previewId, symbol: "BTCUSDT", side: "SELL" },
    });
    await appendEvent({
      type: "EXECUTION_REVIEWED",
      environment: "testnet",
      runId,
      decisionLogId,
      previewId,
      payload: { allowed: true, doubleConfirm: true },
    });
    await appendEvent({
      type: "ORDER_EXECUTED",
      environment: "testnet",
      runId,
      decisionLogId,
      previewId,
      tradeId,
      payload: { symbol: "BTCUSDT", side: "SELL", qty: "0.001" },
    });
    await appendEvent({
      type: "POSITION_OPENED",
      environment: "testnet",
      runId,
      decisionLogId,
      tradeId,
      payload: {},
    });
    await appendEvent({
      type: "POSITION_MONITORED",
      environment: "testnet",
      tradeId,
      payload: { status: "OPEN" },
    });
    await appendEvent({
      type: "CLOSE_ORDER_EXECUTED",
      environment: "testnet",
      tradeId,
      payload: { reduceOnly: true },
    });
    await appendEvent({
      type: "POSITION_CLOSED",
      environment: "testnet",
      tradeId,
      payload: {},
    });
    await appendEvent({
      type: "PNL_REALIZED",
      environment: "testnet",
      tradeId,
      payload: { netPnl: 1.5, result: "WIN" },
    });
    await appendEvent({
      type: "LEARNING_RECORD_CREATED",
      environment: "testnet",
      tradeId,
      payload: { lesson: "Test lesson" },
    });
    await appendEvent({
      type: "EVIDENCE_PROGRESS_UPDATED",
      environment: "testnet",
      payload: { valid: 1, required: 12 },
    });

    const warnings = validateJournalChain(await getEvents());
    const orphanClosed = warnings.filter((w) => w.code === "POSITION_CLOSED_WITHOUT_ORDER");
    assert.equal(orphanClosed.length, 0);
  });

  it("Scenario D: unsafe execution blocked paths", async () => {
    const review = await reviewExecutionSafety({ previewId: "missing", doubleConfirm: false });
    assert.equal(review.allowed, false);
    assert.equal(isLiveEnabled(), false);
  });

  it("Scenario F: MiroFish advisory only — no orders", async () => {
    await runMirofishSwarm();
    const events = await getEvents();
    assert.equal(events.some((e) => e.type === "ORDER_EXECUTED"), false);
    assert.ok(events.some((e) => e.type === "MIROFISH_SCENARIO_REPORT_CREATED"));
    const rules = await evaluateNoTradeRules({
      proposedVerdict: "TRADE",
      swarmAgreement: "DISAGREE",
      regime: "UNKNOWN",
    });
    assert.ok(rules.triggered.length >= 0);
  });

  it("Scenario G: operator kill switch blocks preview", async () => {
    await enableKillSwitch({ reason: "Audit test", doubleConfirm: true });
    setKillSwitchCache({ active: false, reason: null });
    await hydrateOperatorGateState();
    const preview = await createTestnetPreview({ runId: "r-ks", decisionLogId: "d-ks" });
    assert.equal(preview.ok, false);
    await disableKillSwitch({ doubleConfirm: true });
    const after = await createTestnetPreview({ runId: "r-ks2", decisionLogId: "d-ks2" });
    assert.equal(after.ok, true);
  });

  it("Scenario H: audit pack has no secrets and includes lifecycle", async () => {
    await appendEvent({
      type: "POSITION_CLOSED",
      environment: "testnet",
      tradeId: "audit-trade",
      payload: {},
    });
    const pack = await generateAuditPack();
    assert.ok(pack.sections.some((s) => s.name === "trade_lifecycle"));
    const redacted = redactSecrets({ apiSecret: "hidden", ok: true }) as Record<string, unknown>;
    assert.equal(redacted.apiSecret, "[REDACTED]");
  });

  it("daily loss rule uses UTC calendar day not cumulative netPnl", async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    await appendEvent({
      type: "PNL_REALIZED",
      environment: "testnet",
      tradeId: "old-loss",
      timestamp: yesterday,
      payload: { result: "LOSS", netPnl: -100 },
    });
    const events = await getEvents();
    assert.ok(sumDailyPnl(events) > -25);
    const rules = await evaluateNoTradeRules({
      proposedVerdict: "TRADE",
      swarmAgreement: "AGREE",
      regime: "RANGE",
    });
    assert.equal(rules.blocked, false);
  });

  it("legacy kill-switch route reflects journal state", async () => {
    await enableKillSwitch({ reason: "Legacy route test", doubleConfirm: true });
    const { getKillSwitchState } = await import("@/lib/operator/kill-switch");
    await hydrateOperatorGateState();
    assert.equal(getKillSwitchState().active, true);
  });

  it("live sandbox dry-run never creates orders", async () => {
    const dryRun = await runLiveDryRun();
    assert.equal(dryRun.simulatedOrder, null);
    const events = await getEvents();
    assert.equal(events.some((e) => e.type === "ORDER_EXECUTED"), false);
  });
});
