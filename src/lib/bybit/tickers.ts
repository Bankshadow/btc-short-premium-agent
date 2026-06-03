import { BybitApiError, bybitGet } from "./client";

interface TickersResult {
  category: string;
  list: LinearTickerItem[] | OptionTickerItem[];
}

interface LinearTickerItem {
  symbol: string;
  lastPrice: string;
  price24hPcnt: string;
  volume24h: string;
  turnover24h: string;
}

export interface BtcTicker {
  price: number;
  price24hPcnt: number;
  volume24h: number;
  turnover24h: number;
}

export type LinearTicker = BtcTicker;

/** Raw option ticker row from Bybit — pass through for downstream parsing. */
export type OptionTickerItem = Record<string, string>;

function parseNumber(value: string, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new BybitApiError(`Invalid ${field} value: ${value}`, {
      path: "/v5/market/tickers",
    });
  }
  return parsed;
}

function parseLinearTickerRow(ticker: LinearTickerItem): LinearTicker {
  return {
    price: parseNumber(ticker.lastPrice, "lastPrice"),
    price24hPcnt: parseNumber(ticker.price24hPcnt, "price24hPcnt"),
    volume24h: parseNumber(ticker.volume24h, "volume24h"),
    turnover24h: parseNumber(ticker.turnover24h, "turnover24h"),
  };
}

export async function getLinearTicker(symbol: string): Promise<LinearTicker> {
  const result = await bybitGet<TickersResult>("/v5/market/tickers", {
    category: "linear",
    symbol,
  });

  const ticker = (result.list as LinearTickerItem[]).find(
    (item) => item.symbol === symbol,
  );

  if (!ticker) {
    throw new BybitApiError(`${symbol} ticker not found in response`, {
      path: "/v5/market/tickers",
    });
  }

  return parseLinearTickerRow(ticker);
}

export async function getBtcTicker(): Promise<BtcTicker> {
  return getLinearTicker("BTCUSDT");
}

export async function getEthTicker(): Promise<LinearTicker> {
  return getLinearTicker("ETHUSDT");
}

export async function getOptionTickers(): Promise<OptionTickerItem[]> {
  const result = await bybitGet<TickersResult>("/v5/market/tickers", {
    category: "option",
    baseCoin: "BTC",
  });

  return result.list as OptionTickerItem[];
}
