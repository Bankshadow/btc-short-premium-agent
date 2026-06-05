import type { ExchangePositionSnapshot } from "@/lib/exchange/types";
import type { OptionsTestnetClosePreview, OptionsTestnetJournalEntry } from "./types";
import { OPTIONS_TESTNET_BANNER } from "./testnet-gates";

export function buildOptionsTestnetClosePreview(input: {
  trade: OptionsTestnetJournalEntry;
  position?: ExchangePositionSnapshot | null;
  markPrice?: number;
}): OptionsTestnetClosePreview | null {
  const qty = input.position?.size ?? input.trade.qty;
  if (qty <= 0) return null;

  const rawSide = input.position?.side ?? "Sell";
  const positionSide: "Buy" | "Sell" = rawSide === "Buy" ? "Buy" : "Sell";
  const estExitPrice =
    input.markPrice ?? input.position?.markPrice ?? input.trade.premium;

  return {
    previewId: `opt-tn-close-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    optionsTestnetTradeId: input.trade.optionsTestnetTradeId,
    symbol: input.trade.symbol,
    positionSide,
    qty,
    estExitPrice,
    estPremiumUsd: Number((qty * estExitPrice).toFixed(2)),
    reduceOnly: true,
    requiresHumanApproval: true,
    disclaimer: `${OPTIONS_TESTNET_BANNER} Reduce-only close preview — operator must approve.`,
  };
}
