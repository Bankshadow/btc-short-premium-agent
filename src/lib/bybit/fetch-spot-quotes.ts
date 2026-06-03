import { browserBybitGet } from "./browser-client";

interface TickersResult {
  list: Array<Record<string, string>>;
}

function parseBrowserLinearTicker(
  symbol: string,
  list: Array<Record<string, string>>,
) {
  const ticker = list.find((item) => item.symbol === symbol);
  if (!ticker) {
    throw new Error(`${symbol} ticker not found.`);
  }

  const price = Number(ticker.lastPrice);
  const price24hPcnt = Number(ticker.price24hPcnt);

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Invalid ${symbol} price from Bybit.`);
  }

  return {
    price,
    priceChange24hPct: Number.isFinite(price24hPcnt) ? price24hPcnt * 100 : 0,
  };
}

/** Browser-side spot quote (works when server Bybit fetch is blocked). */
export async function fetchBrowserSpotQuote(symbol: string) {
  const result = await browserBybitGet<TickersResult>("/v5/market/tickers", {
    category: "linear",
    symbol,
  });

  const parsed = parseBrowserLinearTicker(symbol, result.list);

  return {
    symbol,
    price: parsed.price,
    priceChange24hPct: parsed.priceChange24hPct,
    timestamp: new Date().toISOString(),
  };
}

export async function fetchBrowserEthSpotQuote() {
  return fetchBrowserSpotQuote("ETHUSDT");
}

export async function fetchBrowserBtcSpotQuote() {
  return fetchBrowserSpotQuote("BTCUSDT");
}
