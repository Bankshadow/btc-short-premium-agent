import { getBinanceBtcKlines } from "@/lib/exchange/binance/binance-market-data";
import { isBinanceMarketDataPreferred } from "@/lib/market-data/provider";
import { BybitApiError, bybitGet } from "./client";

export type BtcKlineInterval = "60" | "240" | "D";

interface KlineResult {
  category: string;
  symbol: string;
  list: string[][];
}

export interface BtcCandle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const KLINE_LIMIT = 200;

function parseCandle(row: string[]): BtcCandle {
  if (row.length < 6) {
    throw new BybitApiError("Malformed kline row", {
      path: "/v5/market/kline",
    });
  }

  const [openTime, open, high, low, close, volume] = row;
  const candle = {
    openTime: Number(openTime),
    open: Number(open),
    high: Number(high),
    low: Number(low),
    close: Number(close),
    volume: Number(volume),
  };

  for (const [field, value] of Object.entries(candle)) {
    if (!Number.isFinite(value)) {
      throw new BybitApiError(`Invalid kline ${field}: ${value}`, {
        path: "/v5/market/kline",
      });
    }
  }

  return candle;
}

export async function getLinearKlines(
  symbol: string,
  interval: BtcKlineInterval,
  limit = KLINE_LIMIT,
  range?: { startMs?: number; endMs?: number },
): Promise<BtcCandle[]> {
  const params: Record<string, string | number> = {
    category: "linear",
    symbol,
    interval,
    limit,
  };
  if (range?.startMs) params.start = range.startMs;
  if (range?.endMs) params.end = range.endMs;

  const result = await bybitGet<KlineResult>("/v5/market/kline", params);

  const candles = result.list.map(parseCandle);

  // Bybit returns newest first — normalize to ascending time.
  return candles.sort((a, b) => a.openTime - b.openTime);
}

const INTERVAL_MS: Record<BtcKlineInterval, number> = {
  "60": 3_600_000,
  "240": 14_400_000,
  D: 86_400_000,
};

/** Fetches klines between start/end by paginating backwards from end. */
export async function getLinearKlinesRange(
  symbol: string,
  interval: BtcKlineInterval,
  startMs: number,
  endMs: number,
): Promise<BtcCandle[]> {
  const step = INTERVAL_MS[interval];
  const all: BtcCandle[] = [];
  const seen = new Set<number>();
  let cursorEnd = endMs;
  let guard = 0;

  while (cursorEnd > startMs && guard < 50) {
    guard += 1;
    const batch = await getLinearKlines(symbol, interval, KLINE_LIMIT, {
      endMs: cursorEnd,
    });
    if (batch.length === 0) break;

    for (const candle of batch) {
      if (candle.openTime < startMs || candle.openTime > endMs) continue;
      if (seen.has(candle.openTime)) continue;
      seen.add(candle.openTime);
      all.push(candle);
    }

    const oldest = batch[0]?.openTime;
    if (!oldest || oldest <= startMs) break;
    cursorEnd = oldest - step;
  }

  return all.sort((a, b) => a.openTime - b.openTime);
}

export async function getBtcKlines(
  interval: BtcKlineInterval,
): Promise<BtcCandle[]> {
  if (isBinanceMarketDataPreferred()) {
    return getBinanceBtcKlines(interval);
  }
  return getLinearKlines("BTCUSDT", interval);
}
