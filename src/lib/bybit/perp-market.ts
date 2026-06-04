import { BybitApiError, bybitGet } from "./client";

interface TickersResult {
  category: string;
  list: Array<Record<string, string>>;
}

export interface PerpTickerSnapshot {
  symbol: string;
  price: number;
  priceChange24hPct: number;
  volume24h: number;
  turnover24h: number;
  fundingRatePct: number | null;
  openInterestValueUsd: number | null;
  timestamp: string;
}

function num(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Fetches a linear (perpetual) ticker snapshot for any USDT-margined symbol.
 * Read-only / analysis-only — no authenticated or trading endpoints.
 */
export async function fetchPerpTickerSnapshot(
  symbol: string,
): Promise<PerpTickerSnapshot> {
  const result = await bybitGet<TickersResult>("/v5/market/tickers", {
    category: "linear",
    symbol,
  });

  const row = result.list.find((item) => item.symbol === symbol);
  if (!row) {
    throw new BybitApiError(`${symbol} perp ticker not found`, {
      path: "/v5/market/tickers",
    });
  }

  const price = num(row.lastPrice);
  if (price === null || price <= 0) {
    throw new BybitApiError(`Invalid ${symbol} perp price`, {
      path: "/v5/market/tickers",
    });
  }

  const change = num(row.price24hPcnt);
  const funding = num(row.fundingRate);

  return {
    symbol,
    price,
    priceChange24hPct: change === null ? 0 : change * 100,
    volume24h: num(row.volume24h) ?? 0,
    turnover24h: num(row.turnover24h) ?? 0,
    fundingRatePct: funding === null ? null : funding * 100,
    openInterestValueUsd: num(row.openInterestValue),
    timestamp: new Date().toISOString(),
  };
}
