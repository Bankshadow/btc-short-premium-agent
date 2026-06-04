import type { PaperInstrument, PaperOrder } from "./paper-order-types";

/**
 * Hypothetical PnL % for paper options (short premium bias).
 * Positive = profit for the simulated desk position.
 */
export function computeOrderPnlPct(
  order: Pick<
    PaperOrder,
    "instrument" | "side" | "entryBtcPrice" | "sizePct"
  >,
  exitBtcPrice: number,
  options?: { premiumCapturedPct?: number },
): number {
  if (order.entryBtcPrice <= 0 || exitBtcPrice <= 0) return 0;
  if (order.instrument === "no_trade" || order.side === "none") return 0;

  const movePct =
    ((exitBtcPrice - order.entryBtcPrice) / order.entryBtcPrice) * 100;

  const scale = order.sizePct / 100;

  if (order.instrument === "sell_call" || order.side === "short") {
    const thetaBonus = options?.premiumCapturedPct ?? 0.4;
    if (movePct <= 0) {
      return Number((thetaBonus * scale + Math.min(1.2, Math.abs(movePct) * 0.08)).toFixed(2));
    }
    return Number(-Math.min(3, (0.6 + movePct * 0.12) * scale).toFixed(2));
  }

  if (order.instrument === "sell_put") {
    if (movePct >= 0) {
      return Number((0.35 * scale + Math.min(1, movePct * 0.06)).toFixed(2));
    }
    return Number(-Math.min(3, (0.5 + Math.abs(movePct) * 0.1) * scale).toFixed(2));
  }

  return Number((movePct * 0.05 * scale).toFixed(2));
}

export function computeUnrealizedPnlPct(
  order: PaperOrder,
  markBtcPrice: number,
): number {
  if (order.status !== "OPEN") return order.unrealizedPnlPct ?? 0;
  return computeOrderPnlPct(order, markBtcPrice);
}

export function tradeWouldWinFromPnl(pnlPct: number): boolean {
  return pnlPct > 0.05;
}
