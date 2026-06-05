import type { MemoryGraphSnapshot } from "./types";

export const MEMORY_GRAPH_STORAGE_KEY = "btc-desk:memory-graph-snapshot";

export function saveMemoryGraphSnapshot(snapshot: MemoryGraphSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MEMORY_GRAPH_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* quota */
  }
}

export function loadMemoryGraphSnapshot(): MemoryGraphSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(MEMORY_GRAPH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MemoryGraphSnapshot;
  } catch {
    return null;
  }
}
