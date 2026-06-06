import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { PerpPaperPosition } from "@/lib/multi-asset/types";
import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import type { OptionsTestnetJournalEntry } from "@/lib/options-execution/types";
import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { TradeLifecycleStage } from "./types";

export function lifecycleFromPaperOrder(order: PaperOrder): TradeLifecycleStage {
  if (order.status === "OPEN") return "MONITORING";
  if (order.status === "CLOSED") return "CLOSED";
  return "PREVIEW";
}

export function lifecycleFromPerpPosition(pos: PerpPaperPosition): TradeLifecycleStage {
  if (pos.status === "OPEN") return "MONITORING";
  return "CLOSED";
}

export function lifecycleFromLiveTrade(entry: LiveTradeJournalEntry): TradeLifecycleStage {
  switch (entry.status) {
    case "PENDING_APPROVAL":
      return "PREVIEW";
    case "APPROVED":
      return "APPROVED";
    case "EXECUTED":
    case "OPEN":
      return "MONITORING";
    case "CLOSED":
      return "CLOSED";
    case "FAILED":
    case "BLOCKED":
    case "CANCELLED":
      return "PREVIEW";
    default:
      return "SIGNAL";
  }
}

export function lifecycleFromOptionsTestnet(
  entry: OptionsTestnetJournalEntry,
): TradeLifecycleStage {
  if (entry.status === "OPEN" || entry.status === "FILLED") return "MONITORING";
  if (entry.status === "CLOSED" || entry.status === "RECONCILED") return "CLOSED";
  if (entry.status === "SUBMITTED") return "OPENED";
  if (entry.status === "PENDING") return "APPROVED";
  return "PREVIEW";
}

export function lifecycleFromBinanceTestnet(
  entry: BinanceTestnetJournalEntry,
): TradeLifecycleStage {
  if (entry.status === "FILLED" || entry.status === "SUBMITTED") return "MONITORING";
  if (entry.status === "CLOSED" || entry.status === "CLOSING") return "CLOSED";
  if (entry.status === "BLOCKED" || entry.status === "FAILED") return "PREVIEW";
  return "PREVIEW";
}

export function lifecycleFromDecision(entry: DecisionLogEntry): TradeLifecycleStage {
  if (entry.outcomeStatus === "RESOLVED") return "RESOLVED";
  if (entry.learningSnapshot) return "LEARNED";
  if (entry.finalVerdict === "TRADE") return "SIGNAL";
  return "SIGNAL";
}

export function advanceLifecycle(
  current: TradeLifecycleStage,
  next: TradeLifecycleStage,
): TradeLifecycleStage {
  const order: TradeLifecycleStage[] = [
    "SIGNAL",
    "PREVIEW",
    "APPROVED",
    "OPENED",
    "MONITORING",
    "CLOSE_RECOMMENDED",
    "CLOSED",
    "RESOLVED",
    "LEARNED",
  ];
  const ci = order.indexOf(current);
  const ni = order.indexOf(next);
  if (ci < 0) return next;
  if (ni < 0) return current;
  return ni >= ci ? next : current;
}
