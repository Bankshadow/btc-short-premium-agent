import type { TradeResult } from "./pnl-types";

const BREAKEVEN_EPSILON = 0.0001;

export function classifyTradeResult(netPnl: number): TradeResult {
  if (netPnl > BREAKEVEN_EPSILON) return "WIN";
  if (netPnl < -BREAKEVEN_EPSILON) return "LOSS";
  return "BREAKEVEN";
}
