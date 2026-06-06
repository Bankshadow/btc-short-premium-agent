import type { MissionFlowSnapshot } from "./types";

const TTL_MS = 12_000;

let cache: {
  snapshot: MissionFlowSnapshot;
  builtAt: number;
} | null = null;

export function readMissionSnapshotCache(): {
  snapshot: MissionFlowSnapshot;
  ageMs: number;
} | null {
  if (!cache) return null;
  const ageMs = Date.now() - cache.builtAt;
  if (ageMs > TTL_MS) return null;
  return { snapshot: cache.snapshot, ageMs };
}

export function writeMissionSnapshotCache(snapshot: MissionFlowSnapshot): void {
  cache = { snapshot, builtAt: Date.now() };
}

export function clearMissionSnapshotCache(): void {
  cache = null;
}
