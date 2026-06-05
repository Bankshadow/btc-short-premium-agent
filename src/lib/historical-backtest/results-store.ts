import type { BacktestCompareResult, BacktestResult } from "./types";

const runs = new Map<string, BacktestResult>();
const comparisons = new Map<string, BacktestCompareResult>();
const runOrder: string[] = [];

const MAX_STORED = 50;

export function saveBacktestResult(result: BacktestResult): void {
  runs.set(result.run.id, result);
  runOrder.unshift(result.run.id);
  while (runOrder.length > MAX_STORED) {
    const old = runOrder.pop();
    if (old) runs.delete(old);
  }
}

export function getBacktestResult(id: string): BacktestResult | null {
  return runs.get(id) ?? null;
}

export function listBacktestResults(): BacktestResult[] {
  return runOrder
    .map((id) => runs.get(id))
    .filter((r): r is BacktestResult => r != null);
}

export function saveBacktestComparison(result: BacktestCompareResult): void {
  const id = `cmp-${result.baseline.run.id}-${result.proposed.run.id}`;
  comparisons.set(id, result);
}

export function getLatestBacktestResult(): BacktestResult | null {
  const id = runOrder[0];
  return id ? runs.get(id) ?? null : null;
}

export function buildAdaptationBridge(
  result: BacktestResult | null,
): import("./types").BacktestAdaptationBridge | null {
  if (!result) return null;
  return {
    lastRunId: result.run.id,
    versionTag: result.run.versionTag,
    totalReturnPct: result.metrics.totalReturnPct,
    winRate: result.metrics.winRate,
    falseTradeCount: result.metrics.falseTradeCount,
    falseSkipCount: result.metrics.falseSkipCount,
    sessionsReplayed: result.metrics.sessionsReplayed,
    alignmentRate: result.metrics.alignmentRate,
    simulationOnly: true,
  };
}

export function buildReadinessBridge(
  result: BacktestResult | null,
): import("./types").BacktestReadinessBridge {
  if (!result || result.metrics.sessionsReplayed === 0) {
    return {
      hasRecentBacktest: false,
      alignmentRate: 0,
      falseTradeCount: 0,
      expectancy: 0,
      sessionsReplayed: 0,
      note: "No historical backtest run — run /backtest before increasing live confidence.",
    };
  }

  const m = result.metrics;
  let note = `Backtest simulation: ${m.alignmentRate}% verdict alignment over ${m.sessionsReplayed} sessions.`;
  if (m.falseTradeCount > 2) {
    note += ` ${m.falseTradeCount} false TRADE signals — review rules before live.`;
  } else if (m.expectancy >= 0 && m.winRate >= 50) {
    note += " Backtest edge positive — supports adaptation review (not auto-apply).";
  }

  return {
    hasRecentBacktest: true,
    alignmentRate: m.alignmentRate,
    falseTradeCount: m.falseTradeCount,
    expectancy: m.expectancy,
    sessionsReplayed: m.sessionsReplayed,
    note,
  };
}
