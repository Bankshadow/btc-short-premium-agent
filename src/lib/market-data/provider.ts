import { loadBinanceConfig } from "@/lib/exchange/binance/binance-config";

/** Prefer Binance public market data when testnet is enabled or explicitly requested. */
export function isBinanceMarketDataPreferred(): boolean {
  const explicit = process.env.MARKET_DATA_PROVIDER?.trim().toLowerCase();
  if (explicit === "binance") return true;
  if (explicit === "bybit") return false;
  return loadBinanceConfig().testnetEnabled;
}

export function marketDataTickerSource(): string {
  return isBinanceMarketDataPreferred() ? "Binance Ticker" : "Bybit Ticker";
}

export function marketDataKlineSource(interval: string): string {
  return isBinanceMarketDataPreferred()
    ? `Binance Klines (${interval})`
    : `Bybit Klines (${interval})`;
}

/** Perp testnet path — options chain not required when Binance is primary market data. */
export function isBinanceFuturesOnlyMode(): boolean {
  return isBinanceMarketDataPreferred();
}
