import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { appendEvent } from "@/lib/journal/journal-query";
import { runProjectionParityCheck } from "./projection-parity";

describe("Projection parity CI gate", () => {
  let tmpDir: string;
  let prevDir: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "parity-gate-"));
    prevDir = process.env.JOURNAL_DATA_DIR;
    process.env.JOURNAL_DATA_DIR = tmpDir;
  });

  afterEach(() => {
    if (prevDir !== undefined) process.env.JOURNAL_DATA_DIR = prevDir;
    else delete process.env.JOURNAL_DATA_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("passes on empty journal zero-state", async () => {
    const report = await runProjectionParityCheck();
    assert.equal(report.status, "OK");
    assert.equal(report.mismatches.length, 0);
    assert.ok(report.checks.length >= 8);
  });

  it("passes after seeded PnL and trade events", async () => {
    await appendEvent({
      type: "ORDER_EXECUTED",
      environment: "testnet",
      tradeId: "parity-trade",
      previewId: "parity-preview",
      decisionLogId: "parity-dl",
      payload: { symbol: "BTCUSDT", side: "SELL", qty: "0.001", orderId: "1" },
    });
    await appendEvent({
      type: "POSITION_CLOSED",
      environment: "testnet",
      tradeId: "parity-trade",
      payload: {},
    });
    await appendEvent({
      type: "PNL_REALIZED",
      environment: "testnet",
      tradeId: "parity-trade",
      payload: {
        netPnl: 3.5,
        result: "WIN",
        qty: "0.001",
        entryPrice: 100000,
        exitPrice: 99000,
        side: "SHORT",
        grossPnl: 3.5,
      },
    });

    const report = await runProjectionParityCheck();
    assert.equal(report.status, "OK");
    assert.equal(report.mismatches.length, 0);
  });
});
