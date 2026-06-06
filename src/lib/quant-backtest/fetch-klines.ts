import {
  getLinearKlinesRange,
  type BtcCandle,
  type BtcKlineInterval,
} from "@/lib/bybit/klines";
import type { Candle } from "@/lib/indicators/technical";
import type { QuantBacktestSymbol, QuantBacktestTimeframe } from "./types";

const TIMEFRAME_MAP: Record<QuantBacktestTimeframe, BtcKlineInterval> = {
  "1h": "60",
  "4h": "240",
  "1d": "D",
};

export function resolveKlineInterval(timeframe: QuantBacktestTimeframe): BtcKlineInterval {
  return TIMEFRAME_MAP[timeframe];
}

export function toCandles(rows: BtcCandle[]): Candle[] {
  return rows.map((row) => ({
    timestamp: row.openTime,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
  }));
}

export async function fetchQuantBacktestCandles(input: {
  symbol: QuantBacktestSymbol;
  timeframe: QuantBacktestTimeframe;
  startDate: string;
  endDate: string;
}): Promise<Candle[]> {
  const startMs = Date.parse(input.startDate);
  const endMs = Date.parse(input.endDate);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    throw new Error("Invalid start/end date range.");
  }

  const interval = resolveKlineInterval(input.timeframe);
  const rows = await getLinearKlinesRange(
    input.symbol,
    interval,
    startMs,
    endMs,
  );
  return toCandles(rows);
}
