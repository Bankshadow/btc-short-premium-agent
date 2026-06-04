import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";

export function deriveTradingStatsFromLog(entries: DecisionLogEntry[]): {
  winRate: number;
  averageWinR: number;
  averageLossR: number;
  resolvedCount: number;
  avgR: number;
} {
  const resolved = entries.filter((e) => e.outcomeStatus === "RESOLVED");
  if (resolved.length === 0) {
    return {
      winRate: 0.52,
      averageWinR: 1.2,
      averageLossR: 1,
      resolvedCount: 0,
      avgR: 0,
    };
  }

  const wins: number[] = [];
  const losses: number[] = [];

  for (const e of resolved) {
    const pnl = e.paperPnl ?? 0;
    if (e.finalVerdict === "TRADE") {
      if (pnl > 0 || e.resolution?.tradeWouldWin === true) wins.push(Math.abs(pnl) || 1);
      else if (pnl < 0 || e.resolution?.tradeWouldWin === false)
        losses.push(Math.abs(pnl) || 1);
    } else if (e.resolution?.tradeWouldWin === false) {
      wins.push(0.35);
    } else if (e.resolution?.tradeWouldWin === true) {
      losses.push(0.35);
    }
  }

  const winCount = wins.length;
  const lossCount = losses.length;
  const total = winCount + lossCount || 1;

  const averageWinR =
    winCount > 0 ? wins.reduce((s, v) => s + v, 0) / winCount : 1.2;
  const averageLossR =
    lossCount > 0 ? losses.reduce((s, v) => s + v, 0) / lossCount : 1;

  const avgR =
    (winCount * averageWinR - lossCount * averageLossR) / Math.max(1, resolved.length);

  return {
    winRate: winCount / total,
    averageWinR,
    averageLossR,
    resolvedCount: resolved.length,
    avgR,
  };
}

export function deriveEquityFromLog(
  entries: DecisionLogEntry[],
  orders: PaperOrder[],
  startUsd = 1_000,
): number {
  let equity = startUsd;
  const closed = orders.filter((o) => o.status === "CLOSED" && o.realizedPnlPct != null);
  if (closed.length > 0) {
    for (const o of closed) {
      equity *= 1 + (o.realizedPnlPct ?? 0) / 100;
    }
    return equity;
  }
  for (const e of entries) {
    if (e.outcomeStatus === "RESOLVED" && e.paperPnl != null) {
      equity *= 1 + e.paperPnl / 100;
    }
  }
  return equity;
}
