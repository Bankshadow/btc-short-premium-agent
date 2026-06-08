import type { PredictionArbScanLogEntry } from "./types";

const MAX_LOG_ENTRIES = 50;
const globalStore: PredictionArbScanLogEntry[] = [];

export function createScanLogId(): string {
  return `parb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function appendScanLog(entry: PredictionArbScanLogEntry): void {
  globalStore.unshift(entry);
  if (globalStore.length > MAX_LOG_ENTRIES) {
    globalStore.length = MAX_LOG_ENTRIES;
  }
}

export function listScanLogs(limit = 20): PredictionArbScanLogEntry[] {
  return globalStore.slice(0, limit);
}

export function getScanLog(id: string): PredictionArbScanLogEntry | null {
  return globalStore.find((e) => e.id === id) ?? null;
}

export function clearScanLogs(): void {
  globalStore.length = 0;
}

/** Replay a prior scan snapshot (read-only). */
export function replayScanLog(id: string): PredictionArbScanLogEntry | null {
  return getScanLog(id);
}
