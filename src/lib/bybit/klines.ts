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
): Promise<BtcCandle[]> {
  const result = await bybitGet<KlineResult>("/v5/market/kline", {
    category: "linear",
    symbol,
    interval,
    limit,
  });

  const candles = result.list.map(parseCandle);

  // Bybit returns newest first — normalize to ascending time.
  return candles.sort((a, b) => a.openTime - b.openTime);
}

export async function getBtcKlines(
  interval: BtcKlineInterval,
): Promise<BtcCandle[]> {
  return getLinearKlines("BTCUSDT", interval);
}
