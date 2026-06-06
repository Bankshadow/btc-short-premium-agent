import type { BtcCandle, BtcKlineInterval } from "@/lib/bybit/klines";
import type { MarketSnapshot, SpotQuote } from "@/lib/types/market";
import { binancePublicGet } from "./binance-client";
import { loadBinanceConfig } from "./binance-config";

const KLINE_LIMIT = 200;

const INTERVAL_MAP: Record<BtcKlineInterval, string> = {
  "60": "1h",
  "240": "4h",
  D: "1d",
};

interface Binance24hrTicker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  volume: string;
}

interface BinancePremiumIndex {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  lastFundingRate: string;
}

interface BinanceOpenInterest {
  symbol: string;
  openInterest: string;
  time: number;
}

function baseUrl(): string {
  return loadBinanceConfig().baseUrl;
}

function parseNumber(value: string | number | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function computeHv30FromCloses(closes: number[]): number {
  if (closes.length < 31) return 0;

  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    const curr = closes[i];
    if (prev <= 0 || curr <= 0) continue;
    const r = Math.log(curr / prev);
    if (Number.isFinite(r)) returns.push(r);
  }

  const window = returns.slice(-30);
  if (window.length < 30) return 0;

  const mean = window.reduce((acc, value) => acc + value, 0) / window.length;
  const variance =
    window.reduce((acc, value) => acc + (value - mean) ** 2, 0) /
    (window.length - 1);
  const dailyVol = Math.sqrt(Math.max(variance, 0));
  return round(dailyVol * Math.sqrt(365) * 100);
}

function parseKlineRow(row: (string | number)[]): BtcCandle {
  if (row.length < 6) {
    throw new Error("Malformed Binance kline row");
  }

  const candle = {
    openTime: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  };

  for (const [field, value] of Object.entries(candle)) {
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid Binance kline ${field}: ${value}`);
    }
  }

  return candle;
}

export async function getBinanceBtcKlines(
  interval: BtcKlineInterval,
  limit = KLINE_LIMIT,
): Promise<BtcCandle[]> {
  const rows = await binancePublicGet<(string | number)[][]>(
    baseUrl(),
    "/fapi/v1/klines",
    {
      symbol: "BTCUSDT",
      interval: INTERVAL_MAP[interval],
      limit,
    },
  );

  return rows.map(parseKlineRow).sort((a, b) => a.openTime - b.openTime);
}

async function fetch24hrTicker(symbol: string): Promise<Binance24hrTicker> {
  return binancePublicGet<Binance24hrTicker>(baseUrl(), "/fapi/v1/ticker/24hr", {
    symbol,
  });
}

async function fetchPremiumIndex(symbol: string): Promise<BinancePremiumIndex> {
  return binancePublicGet<BinancePremiumIndex>(
    baseUrl(),
    "/fapi/v1/premiumIndex",
    { symbol },
  );
}

async function fetchOpenInterest(symbol: string): Promise<number> {
  try {
    const result = await binancePublicGet<BinanceOpenInterest>(
      baseUrl(),
      "/fapi/v1/openInterest",
      { symbol },
    );
    return parseNumber(result.openInterest);
  } catch {
    return 0;
  }
}

export async function fetchBinanceMarketSnapshot(
  symbol = "BTCUSDT",
): Promise<MarketSnapshot> {
  const [ticker, premium, dailyKlines, openInterest] = await Promise.all([
    fetch24hrTicker(symbol),
    fetchPremiumIndex(symbol),
    getBinanceBtcKlines("D", 60),
    fetchOpenInterest(symbol),
  ]);

  const markPrice = parseNumber(premium.markPrice);
  const lastPrice = parseNumber(ticker.lastPrice);
  const spotPrice = markPrice > 0 ? markPrice : lastPrice;
  const hv30 = computeHv30FromCloses(dailyKlines.map((k) => k.close));
  const iv = hv30 > 0 ? round(hv30 * 1.15) : 0;
  const priceChange24hPct = parseNumber(ticker.priceChangePercent);

  return {
    symbol,
    spotPrice,
    timestamp: new Date().toISOString(),
    hv30,
    iv,
    ivHvRatio: hv30 > 0 ? round(iv / hv30) : 0,
    ivRank: 50,
    ivPercentile: 50,
    fundingRate: parseNumber(premium.lastFundingRate),
    openInterestBtc: openInterest,
    oiChange24hPct: null,
    oiChange1hPct: null,
    volume24hBtc: parseNumber(ticker.volume),
    volumeChange24hPct: priceChange24hPct,
    priceChange24hPct,
  };
}

export async function fetchBinanceEthSpotQuote(): Promise<SpotQuote> {
  const ticker = await fetch24hrTicker("ETHUSDT");

  return {
    symbol: "ETHUSDT",
    price: parseNumber(ticker.lastPrice),
    priceChange24hPct: parseNumber(ticker.priceChangePercent),
    timestamp: new Date().toISOString(),
  };
}
