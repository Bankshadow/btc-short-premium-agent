import type { RegimeBrainResult, RegimeHistoryEntry } from "./types";

export const REGIME_BRAIN_HISTORY_KEY = "btc-desk:regime-brain-history";

export function loadRegimeHistory(): RegimeHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REGIME_BRAIN_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RegimeHistoryEntry[];
  } catch {
    return [];
  }
}

export function appendRegimeHistory(
  brain: RegimeBrainResult,
  btcPrice: number,
): RegimeHistoryEntry[] {
  const entry: RegimeHistoryEntry = {
    id: `regime-${Date.now()}`,
    timestamp: brain.generatedAt,
    primaryRegime: brain.primaryRegime,
    canonicalRegime: brain.canonicalRegime,
    deskLabel: brain.deskLabel,
    confidence: brain.regimeConfidence,
    btcPrice,
  };
  const next = [entry, ...loadRegimeHistory()].slice(0, 80);
  if (typeof window !== "undefined") {
    localStorage.setItem(REGIME_BRAIN_HISTORY_KEY, JSON.stringify(next));
  }
  return next;
}
