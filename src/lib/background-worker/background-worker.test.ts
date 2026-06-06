import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { acquireWorkerLock, releaseWorkerLock } from "./lock";
import {
  buildWorkerIdempotencyKey,
  isDuplicateWorkerRun,
} from "./idempotency";
import { loadWorkerState, saveWorkerState, defaultWorkerState } from "./state-store";
import { runWorkerCycle } from "./run-worker";

let tempDir = "";

describe("background worker MVP 46", () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "btc-worker-"));
    process.env.JOURNAL_DATA_DIR = tempDir;
    await saveWorkerState(defaultWorkerState());
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
    delete process.env.JOURNAL_DATA_DIR;
  });

  it("acquires and releases worker lock", async () => {
    const first = await acquireWorkerLock("run-1");
    assert.equal(first.acquired, true);
    const second = await acquireWorkerLock("run-2");
    assert.equal(second.acquired, false);
    await releaseWorkerLock("run-1");
    const third = await acquireWorkerLock("run-3");
    assert.equal(third.acquired, true);
  });

  it("builds idempotency keys per trigger", () => {
    const key = buildWorkerIdempotencyKey({
      trigger: "cron",
      jobs: ["DESK_ANALYZE_CYCLE"],
      runMinute: "2026-06-04T10:15",
    });
    assert.ok(key.includes("cron"));
    assert.ok(key.includes("DESK_ANALYZE_CYCLE"));
  });

  it("skips duplicate completed runs in idempotency window", async () => {
    const key = "wk-test-dup";
    const { appendWorkerHistory } = await import("./state-store");
    await appendWorkerHistory({
      runId: "prev",
      idempotencyKey: key,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      status: "COMPLETED",
      trigger: "cron",
      jobs: [],
      errors: [],
      nextRunAt: null,
      backboneHealthy: true,
      backboneHealth: null,
      autopilotResult: null,
      analyze: null,
      safetyNotice: "test",
      cannotPlaceLiveTrades: true,
      cannotApproveProposals: true,
    });
    assert.equal(await isDuplicateWorkerRun(key), true);
  });

  it("runs worker cycle with safety flags", async () => {
    const result = await runWorkerCycle({
      jobs: ["DATA_HEALTH_CHECK", "PORTFOLIO_SNAPSHOT"],
      entries: [],
      orders: [],
      force: true,
      trigger: "manual",
    });
    assert.equal(result.cannotPlaceLiveTrades, true);
    assert.equal(result.cannotApproveProposals, true);
    assert.ok(result.jobs.length >= 2);
    const state = await loadWorkerState();
    assert.ok(state.lastRun);
  });
});
