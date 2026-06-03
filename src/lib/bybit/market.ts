import type {
  LiveMarketResponse,
  MarketSnapshot,
  OptionCandidate,
  SpotQuote,
} from "@/lib/types/market";
import { findOptionCandidates, parseOptionChain } from "./option-chain";
import { getBtcTicker, getEthTicker, getOptionTickers } from "./tickers";

function annualizedYieldPct(premiumUsd: number, spotPrice: number): number {
  if (spotPrice <= 0 || premiumUsd <= 0) return 0;
  return Number(((premiumUsd / spotPrice) * 365 * 100).toFixed(1));
}

function otmPct(strike: number, spotPrice: number, side: "CALL" | "PUT"): number {
  if (spotPrice <= 0) return 0;
  const distance =
    side === "CALL" ? (strike - spotPrice) / spotPrice : (spotPrice - strike) / spotPrice;
  return Number((Math.max(distance, 0) * 100).toFixed(2));
}

function sdDistance(strike: number, spotPrice: number, ivPercent: number): number {
  if (spotPrice <= 0 || ivPercent <= 0) return 0;
  const sd = spotPrice * (ivPercent / 100) * Math.sqrt(1 / 365);
  if (sd <= 0) return 0;
  return Number((Math.abs(strike - spotPrice) / sd).toFixed(2));
}

export { parseOptionChain, findOptionCandidates } from "./option-chain";
export type {
  ParsedOptionCandidate,
  OptionChainResult,
  OptionSide,
} from "./option-chain";

export async function fetchMarketSnapshot(
  symbol = "BTCUSDT",
): Promise<MarketSnapshot> {
  const ticker = await getBtcTicker();
  const spotPrice = ticker.price;
  const hv30 = 21.5;
  const iv = 32.4;

  return {
    symbol,
    spotPrice,
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

export async function fetchEthSpotQuote(): Promise<SpotQuote> {
  const ticker = await getEthTicker();

  return {
    symbol: "ETHUSDT",
    price: ticker.price,
    priceChange24hPct: ticker.price24hPcnt * 100,
    timestamp: new Date().toISOString(),
  };
}

export async function fetchLiveMarket(): Promise<LiveMarketResponse> {
  const [btc, eth] = await Promise.all([
    fetchMarketSnapshot(),
    fetchEthSpotQuote(),
  ]);

  return { btc, eth };
}

/**
 * Fetches and parses live BTC option chain candidates.
 * Analysis-only — no order placement.
 */
export async function fetchOptionCandidates(
  baseCoin = "BTC",
): Promise<OptionCandidate[]> {
  void baseCoin;

  try {
    const [tickers, btcTicker] = await Promise.all([
      getOptionTickers(),
      getBtcTicker(),
    ]);

    const spotPrice = btcTicker.price;
    const chain = parseOptionChain(tickers);

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
  } catch (error) {
    throw error instanceof Error ? error : new Error("Bybit options fetch failed");
  }
}
