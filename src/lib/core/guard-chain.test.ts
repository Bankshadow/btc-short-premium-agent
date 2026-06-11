import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { appendEvent } from "@/lib/journal/journal-query";
import { runExecuteGuardChain } from "@/lib/core/guard-chain";
import { setRiskMode } from "@/lib/operator/operator-actions";

describe("Guard chain (Slice 6)", () => {
  let tmpDir: string;
  let prevDir: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "guard-chain-"));
    prevDir = process.env.JOURNAL_DATA_DIR;
    process.env.JOURNAL_DATA_DIR = tmpDir;
    process.env.BINANCE_LIVE_ENABLED = "false";
  });

  afterEach(() => {
    if (prevDir !== undefined) process.env.JOURNAL_DATA_DIR = prevDir;
    else delete process.env.JOURNAL_DATA_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("blocks execute when risk mode CONSERVATIVE", async () => {
    await setRiskMode({ mode: "CONSERVATIVE", doubleConfirm: true });
    const result = await runExecuteGuardChain({
      previewId: "missing-preview",
      doubleConfirm: true,
    });
    assert.equal(result.allowed, false);
    assert.ok(result.blockers.some((b) => b.code === "RISK_MODE_CONSERVATIVE"));
  });

  it("operator kill switch blocks before later guards", async () => {
    await appendEvent({
      type: "KILL_SWITCH_ENABLED",
      environment: "testnet",
      payload: { reason: "test" },
    });
    const result = await runExecuteGuardChain({
      previewId: "prev-guard",
      doubleConfirm: true,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.blockers[0]?.guard, "operator");
  });

  it("liveLocked always true", async () => {
    const result = await runExecuteGuardChain({
      previewId: "prev-guard",
      doubleConfirm: false,
    });
    assert.equal(result.liveLocked, true);
  });
});
