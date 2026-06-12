import type { PolymarketAdapter } from "./adapter-types";
import type { PolymarketMarket } from "../types";

function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 3_600_000).toISOString();
}

function minutesFromNow(m: number): string {
  return new Date(Date.now() + m * 60_000).toISOString();
}

/** Mock Polymarket markets — structured for future real API swap. */
export function buildMockPolymarketMarkets(now = Date.now()): PolymarketMarket[] {
  const capturedAt = new Date(now).toISOString();
  return [
    {
      marketId: "pm-btc-up-15m",
      question: "Will BTC be up in the next 15 minutes?",
      slug: "btc-up-15m",
      asset: "BTC",
      marketType: "UP_DOWN",
      outcomes: { yes: "Up", no: "Down" },
      resolutionTime: minutesFromNow(20),
      endTime: minutesFromNow(15),
      yesPrice: 0.52,
      noPrice: 0.48,
      bestBidYes: 0.51,
      bestAskYes: 0.53,
      bestBidNo: 0.47,
      bestAskNo: 0.49,
      liquidity: 4200,
      volume: 18500,
      status: "ACTIVE",
      sourceUrl: "https://polymarket.com/event/btc-up-15m",
      referencePrice: 104_200,
      capturedAt,
    },
    {
      marketId: "pm-btc-above-105k",
      question: "Will BTC close above $105,000 in the next hour?",
      slug: "btc-above-105k-1h",
      asset: "BTC",
      marketType: "ABOVE_BELOW",
      outcomes: { yes: "Above", no: "Below" },
      resolutionTime: hoursFromNow(1.2),
      endTime: hoursFromNow(1),
      yesPrice: 0.41,
      noPrice: 0.59,
      bestBidYes: 0.4,
      bestAskYes: 0.42,
      bestBidNo: 0.58,
      bestAskNo: 0.6,
      liquidity: 8900,
      volume: 42000,
      status: "ACTIVE",
      sourceUrl: "https://polymarket.com/event/btc-above-105k",
      strikePrice: 105_000,
      referencePrice: 104_350,
      capturedAt,
    },
    {
      marketId: "pm-eth-up-15m",
      question: "Will ETH be up in the next 15 minutes?",
      slug: "eth-up-15m",
      asset: "ETH",
      marketType: "UP_DOWN",
      outcomes: { yes: "Up", no: "Down" },
      resolutionTime: minutesFromNow(18),
      endTime: minutesFromNow(14),
      yesPrice: 0.47,
      noPrice: 0.53,
      bestBidYes: 0.46,
      bestAskYes: 0.48,
      bestBidNo: 0.52,
      bestAskNo: 0.54,
      liquidity: 2100,
      volume: 9800,
      status: "ACTIVE",
      sourceUrl: "https://polymarket.com/event/eth-up-15m",
      referencePrice: 3_820,
      capturedAt,
    },
    {
      marketId: "pm-btc-wide-spread",
      question: "Will BTC hit $106k today? (illiquid mock)",
      slug: "btc-106k-today",
      asset: "BTC",
      marketType: "PRICE_TARGET",
      outcomes: { yes: "Yes", no: "No" },
      resolutionTime: hoursFromNow(8),
      endTime: hoursFromNow(6),
      yesPrice: 0.22,
      noPrice: 0.78,
      bestBidYes: 0.15,
      bestAskYes: 0.29,
      bestBidNo: 0.71,
      bestAskNo: 0.85,
      liquidity: 180,
      volume: 900,
      status: "ACTIVE",
      sourceUrl: "https://polymarket.com/event/btc-106k-today",
      strikePrice: 106_000,
      referencePrice: 104_350,
      capturedAt,
    },
    {
      marketId: "pm-crypto-fear-index",
      question: "Crypto fear index above 60 this week?",
      slug: "crypto-fear-60",
      asset: "CRYPTO",
      marketType: "OTHER",
      outcomes: { yes: "Yes", no: "No" },
      resolutionTime: hoursFromNow(72),
      endTime: hoursFromNow(48),
      yesPrice: 0.35,
      noPrice: 0.65,
      bestBidYes: 0.34,
      bestAskYes: 0.36,
      bestBidNo: 0.64,
      bestAskNo: 0.66,
      liquidity: 1500,
      volume: 3200,
      status: "ACTIVE",
      sourceUrl: "https://polymarket.com/event/crypto-fear-60",
      capturedAt,
    },
  ];
}

export class MockPolymarketAdapter implements PolymarketAdapter {
  async fetchCryptoMarkets(): Promise<PolymarketMarket[]> {
    return buildMockPolymarketMarkets();
  }
}

export function createPolymarketAdapter(mockMode: boolean): PolymarketAdapter {
  if (mockMode) return new MockPolymarketAdapter();
  // Real API placeholder — fall back to mock until stable integration.
  return new MockPolymarketAdapter();
}
