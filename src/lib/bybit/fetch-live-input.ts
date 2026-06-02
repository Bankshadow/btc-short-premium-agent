import { applyDerivativesOverrides } from "@/lib/decision/apply-overrides";
import { buildTechnicalSnapshot, type Candle } from "@/lib/indicators/technical";
import type {
  AnalysisInput,
  DecisionEngineInput,
  LiquidationData,
  MacroEventStatus,
  OptionCandidate,
} from "@/lib/types/market";
import { browserBybitGet } from "./browser-client";
import { parseOptionChain } from "./option-chain";

const DEFAULT_LIQUIDATION: LiquidationData = {
  liquidation24h: null,
  source: "mock",
};

interface TickersResult {
  list: Array<Record<string, string>>;
}

interface KlineResult {
  list: string[][];
}

function parseCandle(row: string[]): Candle {
  return {
    timestamp: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  };
}

async function browserGetKlines(
  interval: "60" | "240" | "D",
): Promise<Candle[]> {
  const result = await browserBybitGet<KlineResult>("/v5/market/kline", {
    category: "linear",
    symbol: "BTCUSDT",
    interval,
    limit: 200,
  });

  return result.list
    .map(parseCandle)
    .sort((a, b) => a.timestamp - b.timestamp);
}

function annualizedYieldPct(premiumUsd: number, spotPrice: number): number {
  if (spotPrice <= 0 || premiumUsd <= 0) return 0;
  return Number(((premiumUsd / spotPrice) * 365 * 100).toFixed(1));
}

function otmPct(strike: number, spotPrice: number, side: "CALL" | "PUT"): number {
  if (spotPrice <= 0) return 0;
  const distance =
    side === "CALL"
      ? (strike - spotPrice) / spotPrice
      : (spotPrice - strike) / spotPrice;
  return Number((Math.max(distance, 0) * 100).toFixed(2));
}

function sdDistance(strike: number, spotPrice: number, ivPercent: number): number {
  if (spotPrice <= 0 || ivPercent <= 0) return 0;
  const sd = spotPrice * (ivPercent / 100) * Math.sqrt(1 / 365);
  if (sd <= 0) return 0;
  return Number((Math.abs(strike - spotPrice) / sd).toFixed(2));
}

function buildMarketFromTicker(ticker: {
  price: number;
  price24hPcnt: number;
  volume24h: number;
}): DecisionEngineInput["market"] {
  const hv30 = 21.5;
  const iv = 32.4;

  return {
    symbol: "BTCUSDT",
    spotPrice: ticker.price,
    timestamp: new Date().toISOString(),
    hv30,
    iv,
    ivHvRatio: hv30 > 0 ? Number((iv / hv30).toFixed(2)) : 0,
    ivRank: 58,
    ivPercentile: 62,
    fundingRate: 0.000021,
    openInterestBtc: 312_000,
    oiChange24hPct: null,
    oiChange1hPct: null,
    volume24hBtc: ticker.volume24h,
    volumeChange24hPct: ticker.price24hPcnt * 100,
    priceChange24hPct: ticker.price24hPcnt * 100,
  };
}

function buildOptionCandidates(
  optionTickers: Array<Record<string, string>>,
  spotPrice: number,
): OptionCandidate[] {
  const chain = parseOptionChain(optionTickers);

  return chain.candidates.map((item) => ({
    symbol: item.symbol,
    strike: item.strike,
    expiry: item.expiry,
    optionType: item.side === "CALL" ? "call" : "put",
    markPrice: item.markPrice,
    bid: item.bid,
    ask: item.ask,
    impliedVolatility: item.iv,
    delta: item.delta,
    theta: 0,
    premiumUsd: item.bid,
    annualizedYieldPct: annualizedYieldPct(item.bid, spotPrice),
    otmPct: otmPct(item.strike, spotPrice, item.side),
    sdDistance: sdDistance(item.strike, spotPrice, item.iv),
  }));
}

/**
 * Fetches live Bybit public data from the user's browser (CORS-enabled).
 * Used on Vercel where server-side Bybit requests are blocked with HTTP 403.
 */
export async function fetchLiveDecisionInput(
  options: AnalysisInput & { macroView?: DecisionEngineInput["macroView"] } = {},
): Promise<DecisionEngineInput> {
  const linearResult = await browserBybitGet<TickersResult>(
    "/v5/market/tickers",
    { category: "linear", symbol: "BTCUSDT" },
  );

  const linearTicker = linearResult.list.find(
    (item) => item.symbol === "BTCUSDT",
  );

  if (!linearTicker) {
    throw new Error("BTCUSDT ticker not found.");
  }

  const ticker = {
    price: Number(linearTicker.lastPrice),
    price24hPcnt: Number(linearTicker.price24hPcnt),
    volume24h: Number(linearTicker.volume24h),
  };

  if (!Number.isFinite(ticker.price) || ticker.price <= 0) {
    throw new Error("Invalid BTC spot price from Bybit.");
  }

  const [optionResult, dailyKlines, h4Klines, h1Klines] = await Promise.all([
    browserBybitGet<TickersResult>("/v5/market/tickers", {
      category: "option",
      baseCoin: "BTC",
    }),
    browserGetKlines("D"),
    browserGetKlines("240"),
    browserGetKlines("60"),
  ]);

  const marketBase = buildMarketFromTicker(ticker);
  const macroEvent: MacroEventStatus = options.macroEvent ?? {
    hasEventBeforeSettlement: options.macroEventToday ?? false,
  };

  const { market, liquidation } = applyDerivativesOverrides(
    marketBase,
    DEFAULT_LIQUIDATION,
    options.derivativesOverrides,
  );

  const dailyCandles = dailyKlines;
  const h4Candles = h4Klines;
  const h1Candles = h1Klines;

  return {
    market,
    optionCandidates: buildOptionCandidates(optionResult.list, ticker.price),
    technicalDaily: buildTechnicalSnapshot("BTCUSDT", dailyCandles, []),
    technical4h: buildTechnicalSnapshot("BTCUSDT", h4Candles, h4Candles),
    technical1h: buildTechnicalSnapshot("BTCUSDT", h1Candles, []),
    macroEvent,
    liquidation,
    macroView: options.macroView ?? "neutral",
    consecutiveLosses: options.consecutiveLosses,
    priorDayRallyPct: options.priorDayRallyPct,
  };
}
