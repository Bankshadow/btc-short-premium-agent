import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { StrictPaperMetrics } from "./types";

function isStrictOrder(order: PaperOrder): boolean {
  return order.paperMode !== "RELAXED_PAPER";
}

function maxDrawdown(series: number[]): number {
  let peak = 0;
  let equity = 0;
  let maxDd = 0;
  for (const r of series) {
    equity += r;
    if (equity > peak) peak = equity;
    maxDd = Math.max(maxDd, peak - equity);
  }
  return Number(maxDd.toFixed(2));
}

function recentLossStreak(entries: DecisionLogEntry[], orders: PaperOrder[]): number {
  const outcomes: { at: string; win: boolean }[] = [];

  for (const o of orders.filter((x) => isStrictOrder(x) && x.status === "CLOSED")) {
    outcomes.push({
      at: o.closedAt ?? o.openedAt,
      win: (o.realizedPnlPct ?? 0) > 0,
    });
  }

  for (const e of entries.filter(
    (x) => x.outcomeStatus === "RESOLVED" && x.paperPnl != null,
  )) {
    const linked = orders.find(
      (o) => o.decisionLogId === e.id && o.paperMode === "RELAXED_PAPER",
    );
    if (linked) continue;
    outcomes.push({
      at: e.timestamp,
      win: (e.paperPnl ?? 0) > 0,
    });
  }

  outcomes.sort((a, b) => b.at.localeCompare(a.at));
  let streak = 0;
  for (const o of outcomes) {
    if (!o.win) streak += 1;
    else break;
  }
  return streak;
}

export function computeStrictPaperMetrics(
  entries: DecisionLogEntry[],
  orders: PaperOrder[],
): StrictPaperMetrics {
  const relaxedExcludedCount = orders.filter(
    (o) => o.paperMode === "RELAXED_PAPER",
  ).length;

  const strictClosed = orders.filter(
    (o) => isStrictOrder(o) && o.status === "CLOSED",
  );

  const pnlSeries = strictClosed.map((o) => o.realizedPnlPct ?? 0);
  let winCount = strictClosed.filter((o) => (o.realizedPnlPct ?? 0) > 0).length;

  const entryOnly = entries.filter((e) => {
    if (e.outcomeStatus !== "RESOLVED" || e.paperPnl == null) return false;
    const hasStrictOrder = orders.some(
      (o) =>
        o.decisionLogId === e.id &&
        o.status === "CLOSED" &&
        isStrictOrder(o),
    );
    return !hasStrictOrder;
  });

  for (const e of entryOnly) {
    pnlSeries.push(e.paperPnl ?? 0);
    if ((e.paperPnl ?? 0) > 0) winCount += 1;
  }

  const closedTrades = pnlSeries.length;
  const winRate =
    closedTrades > 0
      ? Number(((winCount / closedTrades) * 100).toFixed(1))
      : 0;
  const avgPnlPct =
    closedTrades > 0
      ? Number(
          (pnlSeries.reduce((s, v) => s + v, 0) / closedTrades).toFixed(2),
        )
      : 0;

  return {
    closedTrades,
    winRate,
    avgPnlPct,
    maxDrawdownPct: maxDrawdown(pnlSeries),
    recentLossStreak: recentLossStreak(entries, orders),
    expectancy: avgPnlPct,
    relaxedExcludedCount,
  };
}
