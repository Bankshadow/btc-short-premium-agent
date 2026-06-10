import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { createTestnetPreview } from "@/lib/execution/create-preview";
import { evaluatePreviewCreationGate } from "@/lib/risk/risk-gate";

describe("MVP 2 preview engine", () => {
  let tmpDir: string;
  let prevDir: string | undefined;
  let prevMock: string | undefined;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v2-mvp2-"));
    prevDir = process.env.JOURNAL_DATA_DIR;
    prevMock = process.env.V2_MVP2_MOCK_TRADE;
    process.env.JOURNAL_DATA_DIR = tmpDir;
    process.env.BINANCE_TESTNET_ENABLED = "true";
    process.env.V2_MVP2_MOCK_TRADE = "true";
  });

  after(() => {
    if (prevDir !== undefined) process.env.JOURNAL_DATA_DIR = prevDir;
    else delete process.env.JOURNAL_DATA_DIR;
    if (prevMock !== undefined) process.env.V2_MVP2_MOCK_TRADE = prevMock;
    else delete process.env.V2_MVP2_MOCK_TRADE;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("preview requires decisionLogId", async () => {
    const gate = evaluatePreviewCreationGate({
      runId: "run-1",
      decisionLogId: null,
      symbol: "BTCUSDT",
      side: "SELL",
      notionalUsd: 50,
      environment: "TESTNET",
    });
    assert.equal(gate.allowed, false);
    assert.ok(gate.blockReasons.some((r) => r.includes("decisionLogId")));
  });

  it("preview requires runId", async () => {
    const gate = evaluatePreviewCreationGate({
      runId: null,
      decisionLogId: "dl-1",
      symbol: "BTCUSDT",
      side: "SELL",
      notionalUsd: 50,
      environment: "TESTNET",
    });
    assert.equal(gate.allowed, false);
    assert.ok(gate.blockReasons.some((r) => r.includes("runId")));
  });

  it("preview has expiresAt and writes PREVIEW_CREATED", async () => {
    const result = await createTestnetPreview({
      runId: "run-test",
      decisionLogId: "dl-test",
    });
    assert.equal(result.ok, true);
    assert.ok(result.preview);
    assert.ok(result.preview!.previewId.startsWith("prev-"));
    assert.ok(Date.parse(result.preview!.expiresAt) > Date.now());

    const { getEvents } = await import("@/lib/journal/journal-query");
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "PREVIEW_CREATED"));
  });

  it("blocked preview writes PREVIEW_BLOCKED", async () => {
    const result = await createTestnetPreview({
      runId: "run-block",
      decisionLogId: "dl-block",
      notionalUsd: 9999,
    });
    assert.equal(result.ok, false);
    assert.equal(result.eventType, "PREVIEW_BLOCKED");

    const { getEvents } = await import("@/lib/journal/journal-query");
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "PREVIEW_BLOCKED"));
  });

  it("analysis TRADE creates preview and WAIT does not", async () => {
    const { runAnalysis } = await import("@/lib/analysis/analysis-runner");
    const { getEvents } = await import("@/lib/journal/journal-query");

    process.env.V2_MVP2_MOCK_TRADE = "true";
    const tradeRun = await runAnalysis();
    assert.equal(tradeRun.verdict.verdict, "TRADE");
    assert.ok(tradeRun.previewId);

    let events = await getEvents();
    assert.ok(events.some((e) => e.type === "PREVIEW_CREATED"));

    process.env.V2_MVP2_MOCK_TRADE = "false";
    const waitRun = await runAnalysis();
    assert.equal(waitRun.verdict.verdict, "WAIT");
    assert.equal(waitRun.previewId, null);

    events = await getEvents();
    const previewCreatedForWait = events.filter(
      (e) => e.type === "PREVIEW_CREATED" && e.runId === waitRun.runId,
    );
    assert.equal(previewCreatedForWait.length, 0);
  });

  it("no order execution occurs", async () => {
    const { getEvents } = await import("@/lib/journal/journal-query");
    const events = await getEvents();
    assert.ok(!events.some((e) => e.type === "ORDER_EXECUTED"));
  });
});
