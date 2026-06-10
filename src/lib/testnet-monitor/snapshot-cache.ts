import type { TestnetMonitorSnapshot } from "./types";

/** Shared TTL for read-heavy API routes and mission snapshot assembly. */
export const TESTNET_MONITOR_CACHE_TTL_MS = 45_000;

let cache: {
  snapshot: TestnetMonitorSnapshot;
  builtAt: number;
} | null = null;

let inflight: Promise<TestnetMonitorSnapshot> | null = null;

export function readTestnetMonitorSnapshotCache(): {
  snapshot: TestnetMonitorSnapshot;
  ageMs: number;
} | null {
  if (!cache) return null;
  const ageMs = Date.now() - cache.builtAt;
  if (ageMs > TESTNET_MONITOR_CACHE_TTL_MS) return null;
  return { snapshot: cache.snapshot, ageMs };
}

export function writeTestnetMonitorSnapshotCache(
  snapshot: TestnetMonitorSnapshot,
): void {
  cache = { snapshot, builtAt: Date.now() };
}

export function invalidateTestnetMonitorSnapshotCache(): void {
  cache = null;
  inflight = null;
}

/** Coalesce parallel monitor builds and serve cached snapshots within TTL. */
export async function withTestnetMonitorSnapshotDedup(
  build: () => Promise<TestnetMonitorSnapshot>,
  options: { fresh?: boolean } = {},
): Promise<TestnetMonitorSnapshot> {
  if (!options.fresh) {
    const hit = readTestnetMonitorSnapshotCache();
    if (hit) return hit.snapshot;
    if (inflight) return inflight;
  }

  const run = build().then((snapshot) => {
    writeTestnetMonitorSnapshotCache(snapshot);
    return snapshot;
  });

  if (!options.fresh) {
    inflight = run.finally(() => {
      if (inflight === run) inflight = null;
    });
    return inflight;
  }

  return run;
}
