import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import type { SupervisorClosePreview, ClosePreviewRequest } from "./types";
import { LIVE_SUPERVISOR_SAFETY_NOTICE } from "./types";

export function buildSupervisorClosePreview(input: {
  trade: LiveTradeJournalEntry;
  request: ClosePreviewRequest;
  markPrice: number;
}): SupervisorClosePreview | null {
  const qty = input.trade.entry?.qty ?? 0;
  if (qty <= 0) return null;

  const partialPct =
    input.request.mode === "partial_close"
      ? Math.min(90, Math.max(10, input.request.partialPct ?? 50))
      : 100;
  const closeQty = Number(((qty * partialPct) / 100).toFixed(6));
  if (closeQty <= 0) return null;

  const isLong =
    input.trade.side.toLowerCase() === "buy" || input.trade.side === "LONG";
  const positionSide: "Buy" | "Sell" = isLong ? "Buy" : "Sell";

  return {
    previewId: `sup-prev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    liveTradeId: input.trade.liveTradeId,
    mode: input.request.mode,
    symbol: input.trade.symbol,
    positionSide,
    qty: closeQty,
    estExitPrice: input.markPrice,
    estNotionalUsd: Number((closeQty * input.markPrice).toFixed(2)),
    reduceOnly: true,
    requiresHumanApproval: true,
    disclaimer: `${LIVE_SUPERVISOR_SAFETY_NOTICE} Reduce-only preview — operator must approve before execute.`,
  };
}
