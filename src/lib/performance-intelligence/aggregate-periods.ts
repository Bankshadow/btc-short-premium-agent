import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { TradeEvaluationResult } from "@/lib/self-learning/types";
import type { PeriodPerformanceSlice } from "./types";

function weekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function committeeWasCorrect(entry: DecisionLogEntry): boolean {
  const win = entry.resolution?.tradeWouldWin;
  if (win === null || win === undefined) return entry.finalVerdict !== "TRADE";
  if (entry.finalVerdict === "TRADE") return win === true;
  if (entry.finalVerdict === "SKIP") return win === false;
  return true;
}

function aggregateBucket(
  entries: DecisionLogEntry[],
  evaluations: TradeEvaluationResult[],
  keyFn: (d: Date) => string,
  labelFn: (key: string) => string,
): PeriodPerformanceSlice[] {
  const buckets = new Map<string, DecisionLogEntry[]>();

  for (const entry of entries.filter((e) => e.outcomeStatus === "RESOLVED")) {
    const at = entry.resolution?.resolvedAt ?? entry.timestamp;
    const key = keyFn(new Date(at));
    const list = buckets.get(key) ?? [];
    list.push(entry);
    buckets.set(key, list);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodKey, rows]) => {
      const wins = rows.filter((e) => (e.paperPnl ?? 0) > 0).length;
      const tradeRows = rows.filter((e) => e.finalVerdict === "TRADE");
      const tradeWins = tradeRows.filter(
        (e) => e.resolution?.tradeWouldWin === true,
      ).length;
      const skipRows = rows.filter((e) => e.finalVerdict === "SKIP");
      const skipCorrect = skipRows.filter(
        (e) => e.resolution?.tradeWouldWin === false,
      ).length;

      const falseTrades = rows.filter((e) => e.falseTradeFlag).length;
      const falseSkips = rows.filter((e) => e.falseSkipFlag).length;
      const netPnl = rows.reduce((s, e) => s + (e.paperPnl ?? 0), 0);
      const avgPnl =
        rows.length > 0 ? netPnl / rows.length : 0;
      const committeeCorrect = rows.filter(committeeWasCorrect).length;

      const evalRegret = evaluations
        .filter((ev) => rows.some((r) => r.id === ev.decisionLogId))
        .flatMap((ev) => ev.agentEvaluations.map((a) => a.reasoning.regretScore));
      const regretScore =
        evalRegret.length > 0
          ? Number(
              (
                evalRegret.reduce((s, v) => s + v, 0) / evalRegret.length
              ).toFixed(2),
            )
          : 0;

      const timestamps = rows.map(
        (e) => e.resolution?.resolvedAt ?? e.timestamp,
      );

      return {
        periodKey,
        periodLabel: labelFn(periodKey),
        startAt: timestamps.sort()[0],
        endAt: timestamps.sort().reverse()[0],
        resolvedTrades: rows.length,
        winRate: rows.length
          ? Number(((wins / rows.length) * 100).toFixed(1))
          : 0,
        avgPnlPct: Number(avgPnl.toFixed(2)),
        netPnlPct: Number(netPnl.toFixed(2)),
        committeeAccuracy: rows.length
          ? Number(((committeeCorrect / rows.length) * 100).toFixed(1))
          : 0,
        falseTrades,
        falseSkips,
        regretScore,
        tradeCallAccuracy:
          tradeRows.length > 0
            ? Number(((tradeWins / tradeRows.length) * 100).toFixed(1))
            : 0,
        skipCallAccuracy:
          skipRows.length > 0
            ? Number(((skipCorrect / skipRows.length) * 100).toFixed(1))
            : 0,
      } as PeriodPerformanceSlice & {
        tradeCallAccuracy: number;
        skipCallAccuracy: number;
      };
    })
    .map(({ tradeCallAccuracy: _t, skipCallAccuracy: _s, ...slice }) => slice);
}

export function buildWeeklyPerformance(
  entries: DecisionLogEntry[],
  evaluations: TradeEvaluationResult[] = [],
): PeriodPerformanceSlice[] {
  return aggregateBucket(
    entries,
    evaluations,
    weekKey,
    (k) => `Week ${k}`,
  ).slice(-12);
}

export function buildMonthlyPerformance(
  entries: DecisionLogEntry[],
  evaluations: TradeEvaluationResult[] = [],
): PeriodPerformanceSlice[] {
  return aggregateBucket(
    entries,
    evaluations,
    monthKey,
    (k) => k,
  ).slice(-12);
}

export function buildImprovementTrend(
  weekly: PeriodPerformanceSlice[],
  monthly: PeriodPerformanceSlice[],
): import("./types").AiImprovementTrend {
  if (weekly.length < 2 && monthly.length < 2) {
    return {
      direction: "INSUFFICIENT_DATA",
      weeklyDeltaWinRate: 0,
      monthlyDeltaWinRate: 0,
      weeklyDeltaPnl: 0,
      monthlyDeltaPnl: 0,
      summary: "Need at least two periods of resolved trades to measure improvement.",
    };
  }

  const wLast = weekly[weekly.length - 1];
  const wPrev = weekly[weekly.length - 2];
  const mLast = monthly[monthly.length - 1];
  const mPrev = monthly[monthly.length - 2];

  const weeklyDeltaWinRate = wLast && wPrev ? wLast.winRate - wPrev.winRate : 0;
  const monthlyDeltaWinRate = mLast && mPrev ? mLast.winRate - mPrev.winRate : 0;
  const weeklyDeltaPnl = wLast && wPrev ? wLast.avgPnlPct - wPrev.avgPnlPct : 0;
  const monthlyDeltaPnl = mLast && mPrev ? mLast.avgPnlPct - mPrev.avgPnlPct : 0;

  const score =
    weeklyDeltaWinRate * 0.4 +
    monthlyDeltaWinRate * 0.3 +
    weeklyDeltaPnl * 0.2 +
    monthlyDeltaPnl * 0.1;

  const direction =
    score > 2 ? "IMPROVING" : score < -2 ? "DECLINING" : "FLAT";

  return {
    direction,
    weeklyDeltaWinRate: Number(weeklyDeltaWinRate.toFixed(1)),
    monthlyDeltaWinRate: Number(monthlyDeltaWinRate.toFixed(1)),
    weeklyDeltaPnl: Number(weeklyDeltaPnl.toFixed(2)),
    monthlyDeltaPnl: Number(monthlyDeltaPnl.toFixed(2)),
    summary:
      direction === "IMPROVING"
        ? "Recent periods show improving win rate and/or PnL."
        : direction === "DECLINING"
          ? "Recent periods show declining performance — review agents and rules."
          : "Performance is stable across recent periods.",
  };
}
