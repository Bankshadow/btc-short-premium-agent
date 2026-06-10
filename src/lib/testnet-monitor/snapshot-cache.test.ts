import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  invalidateTestnetMonitorSnapshotCache,
  readTestnetMonitorSnapshotCache,
  withTestnetMonitorSnapshotDedup,
} from "./snapshot-cache";
import type { TestnetMonitorSnapshot } from "./types";

function stubSnapshot(id: string): TestnetMonitorSnapshot {
  return {
    lastUpdatedAt: id,
  } as TestnetMonitorSnapshot;
}

describe("testnet monitor snapshot cache", () => {
  it("dedupes parallel builds", async () => {
    invalidateTestnetMonitorSnapshotCache();
    let builds = 0;
    const build = async () => {
      builds += 1;
      await new Promise((r) => setTimeout(r, 20));
      return stubSnapshot(`snap-${builds}`);
    };

    const [a, b] = await Promise.all([
      withTestnetMonitorSnapshotDedup(build),
      withTestnetMonitorSnapshotDedup(build),
    ]);

    assert.equal(builds, 1);
    assert.equal(a.lastUpdatedAt, b.lastUpdatedAt);
    assert.ok(readTestnetMonitorSnapshotCache());
  });

  it("fresh bypasses cache", async () => {
    invalidateTestnetMonitorSnapshotCache();
    let builds = 0;
    const build = async () => {
      builds += 1;
      return stubSnapshot(`snap-${builds}`);
    };

    await withTestnetMonitorSnapshotDedup(build);
    const fresh = await withTestnetMonitorSnapshotDedup(build, { fresh: true });
    assert.equal(builds, 2);
    assert.equal(fresh.lastUpdatedAt, "snap-2");
  });
});
