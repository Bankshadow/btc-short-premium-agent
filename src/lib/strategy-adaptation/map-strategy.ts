import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { UnifiedPaperPosition } from "@/lib/portfolio/unified-types";
import { primaryStrategyForPaper } from "@/lib/validation/classify-strategy";
import type { StrategyId } from "@/lib/validation/validation-types";

const NAME_TO_ID: Record<string, StrategyId> = {
  btc_short_premium: "options_short_premium",
  btc_put_premium: "options_short_premium",
  btc_options: "options_short_premium",
  perp_directional: "futures_long",
  spot: "spot",
};

export function strategyIdFromPaperOrder(order: PaperOrder): StrategyId {
  return primaryStrategyForPaper(order.instrument, order.side);
}

export function strategyIdFromUnifiedPosition(
  position: UnifiedPaperPosition,
): StrategyId {
  if (position.book === "btc_options") {
    return primaryStrategyForPaper(
      position.notes.includes("sell_put") ? "sell_put" : "sell_call",
      position.side,
    );
  }
  const mapped = NAME_TO_ID[position.strategyName];
  if (mapped) return mapped;
  if (position.side === "short") return "futures_short";
  if (position.side === "long") return "futures_long";
  return "futures_long";
}

export function strategyIdFromLabel(label: string): StrategyId | null {
  return NAME_TO_ID[label] ?? null;
}
