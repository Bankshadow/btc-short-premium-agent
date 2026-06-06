/** Binance USD-M testnet minimum notional (observed). */
export const BINANCE_MIN_NOTIONAL_USD = 50;

/**
 * Scale testnet notional by trust progress — smaller size until enough completed trades.
 * Floor at $50 (exchange min); ceiling at configured max.
 */
export function resolveTrustScaledNotionalUsd(input: {
  completedTrades: number;
  minRequired: number;
  maxNotionalUsd: number;
}): number {
  const max = input.maxNotionalUsd;
  if (input.completedTrades >= input.minRequired) {
    return max;
  }
  const ratio = Math.max(0.5, input.completedTrades / Math.max(1, input.minRequired));
  const scaled = Math.round(max * ratio);
  return Math.max(BINANCE_MIN_NOTIONAL_USD, Math.min(max, scaled));
}
