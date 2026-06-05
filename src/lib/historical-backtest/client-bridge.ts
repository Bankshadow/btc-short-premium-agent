import type { BacktestResult } from "./types";
import { buildAdaptationBridge, buildReadinessBridge } from "./results-store";

const BACKTEST_HISTORY_KEY = "btc-desk:backtest-history";

export function loadLatestClientBacktest(): BacktestResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(BACKTEST_HISTORY_KEY);
    const list = raw ? (JSON.parse(raw) as BacktestResult[]) : [];
    return list[0] ?? null;
  } catch {
    return null;
  }
}

export function loadBacktestReadinessBridge() {
  return buildReadinessBridge(loadLatestClientBacktest());
}

export function loadBacktestAdaptationBridge() {
  return buildAdaptationBridge(loadLatestClientBacktest());
}
