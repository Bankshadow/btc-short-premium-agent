import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { buildMissionSnapshot } from "@/lib/mission/mission-snapshot";
import { evaluateExecuteGate, RISK_POLICY } from "@/lib/risk/risk-gate";

describe("mission snapshot", () => {
  it("returns zero-state from empty events", () => {
    const snap = buildMissionSnapshot([]);
    assert.equal(snap.startCapital, 1000);
    assert.equal(snap.targetCapital, 10000);
    assert.equal(snap.currentEquity, 1000);
    assert.equal(snap.progressPct, 0);
    assert.equal(snap.totalTrades, 0);
    assert.equal(snap.win, 0);
    assert.equal(snap.loss, 0);
    assert.equal(snap.netPnl, 0);
    assert.equal(snap.openPositions, 0);
    assert.equal(snap.liveLocked, true);
  });
});

describe("risk gate", () => {
  it("blocks execution without decisionLogId and previewId", () => {
    const r = evaluateExecuteGate({});
    assert.equal(r.allowed, false);
    assert.equal(r.policy.liveLocked, true);
    assert.ok(r.blockReasons.some((x) => x.includes("decisionLogId")));
    assert.ok(r.blockReasons.some((x) => x.includes("previewId")));
  });

  it("exports sprint 1 risk policy", () => {
    assert.equal(RISK_POLICY.testnetOnly, true);
    assert.equal(RISK_POLICY.requireDoubleConfirm, true);
  });
});

describe("analysis run", () => {
  let tmpDir: string;
  let prevDir: string | undefined;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v2-journal-"));
    prevDir = process.env.JOURNAL_DATA_DIR;
    process.env.JOURNAL_DATA_DIR = tmpDir;
    process.env.BINANCE_TESTNET_ENABLED = "true";
    process.env.V2_MVP2_MOCK_TRADE = "false";
  });

  after(() => {
    if (prevDir !== undefined) process.env.JOURNAL_DATA_DIR = prevDir;
    else delete process.env.JOURNAL_DATA_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates runId, decisionLogId, and journal events", async () => {
    const { runAnalysis } = await import("@/lib/analysis/analysis-runner");
    const { getEvents } = await import("@/lib/journal/journal-query");

    const result = await runAnalysis();
    assert.ok(result.runId.startsWith("run-"));
    assert.ok(result.decisionLogId.startsWith("dl-"));
    assert.equal(result.verdict.verdict, "WAIT");

    const events = await getEvents();
    const types = events.map((e) => e.type);
    assert.ok(types.includes("ANALYSIS_STARTED"));
    assert.ok(types.includes("VERDICT_CREATED"));
    assert.ok(types.includes("MISSION_SNAPSHOT_UPDATED"));
  });
});
