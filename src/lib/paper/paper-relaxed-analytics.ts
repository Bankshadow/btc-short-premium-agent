import type { PaperOrder } from "./paper-order-types";
import type {
  RelaxedPaperAnalytics,
  RelaxedPaperAnalyticsRow,
} from "./paper-relaxed-types";

export function computeRelaxedPaperAnalytics(
  orders: PaperOrder[],
): RelaxedPaperAnalytics {
  const relaxedOrders = orders.filter((o) => o.paperMode === "RELAXED_PAPER");
  const skippedByStrict = relaxedOrders.filter(
    (o) => o.strictVerdict !== "TRADE",
  );
  const closed = relaxedOrders.filter((o) => o.status === "CLOSED");

  const wins = closed.filter((o) => (o.realizedPnlPct ?? 0) > 0);
  const losses = closed.filter((o) => (o.realizedPnlPct ?? 0) < 0);

  const entries: RelaxedPaperAnalyticsRow[] = relaxedOrders.map((o) => ({
    orderId: o.id,
    decisionLogId: o.decisionLogId,
    strictVerdict: o.strictVerdict ?? o.committeeVerdict,
    relaxedVerdict: o.relaxedVerdict ?? "TRADE",
    relaxedReason: o.relaxedReason ?? null,
    outcomePnlPct: o.realizedPnlPct,
    outcomeWin:
      o.status === "CLOSED"
        ? (o.realizedPnlPct ?? 0) > 0
        : null,
    closedAt: o.closedAt,
  }));

  const avgPnl =
    closed.length > 0
      ? Number(
          (
            closed.reduce((s, o) => s + (o.realizedPnlPct ?? 0), 0) /
            closed.length
          ).toFixed(2),
        )
      : 0;

  const regretScore =
    closed.length > 0
      ? Number(((losses.length / closed.length) * 100).toFixed(1))
      : 0;

  return {
    strictWouldHaveSkipped: skippedByStrict.length,
    relaxedEntered: relaxedOrders.length,
    closedCount: closed.length,
    relaxedWinRate:
      closed.length > 0
        ? Number(((wins.length / closed.length) * 100).toFixed(1))
        : 0,
    relaxedRegretScore: regretScore,
    avgRelaxedPnlPct: avgPnl,
    entries,
  };
}
