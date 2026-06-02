import type { DataSourceError, MarketSnapshot } from "@/lib/types/market";

export const BYBIT_API_FAILED_MESSAGE = "Bybit API failed. Please retry.";

export const MANUAL_DERIVATIVES_MESSAGE =
  "Liquidation / OI data is manually provided.";

/** True when live BTC ticker could not be loaded from Bybit. */
export function isBybitCriticalFailure(
  market: MarketSnapshot,
  sourceErrors: DataSourceError[],
): boolean {
  if (market.spotPrice > 0) return false;

  return sourceErrors.some(
    (error) =>
      error.source === "Bybit Ticker" ||
      error.source.startsWith("Bybit Klines"),
  );
}

export function isBybitFetchError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("bybit") ||
    lower.includes(BYBIT_API_FAILED_MESSAGE.toLowerCase())
  );
}
