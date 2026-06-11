import type { StaleOpenTradeWarning } from "./trade-reconciliation";
import { MANUAL_REPAIR_REQUIRED } from "./trade-reconciliation";

export const STALE_TRADE_BANNER_MESSAGE =
  "stale trade requires manual repair. It is not counted as active open exposure.";

export const PNL_PENDING_LABEL = "PnL pending — missing fill data.";

export function staleTradeBannerText(count: number): string {
  if (count === 1) {
    return `1 ${STALE_TRADE_BANNER_MESSAGE}`;
  }
  return `${count} stale trades require manual repair. They are not counted as active open exposure.`;
}

export function staleTradeRequiredAction(warning: StaleOpenTradeWarning): string {
  if (warning.recommendation === MANUAL_REPAIR_REQUIRED) {
    return "Review journal lifecycle and repair via /api/journal/repair or operator workflow.";
  }
  if (warning.projectedStatus === "CLOSED_PENDING_PNL") {
    return "Close event exists — PnL may remain pending until fill data is available.";
  }
  return "Reconcile local OPEN state against exchange FLAT position.";
}
