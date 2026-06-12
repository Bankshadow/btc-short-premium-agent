import type { CryptoDataAdapter } from "./adapter-types";
import type { CryptoPriceSnapshot, DataQualityStatus } from "../types";

function snapshot(
  symbol: "BTC" | "ETH",
  price: number,
  opts: {
    change5s: number;
    change15s: number;
    change1m: number;
    change5m: number;
    volatility: number;
    momentumScore: number;
    quality?: DataQualityStatus;
    ageMs?: number;
  },
): CryptoPriceSnapshot {
  const ts = new Date(Date.now() - (opts.ageMs ?? 0)).toISOString();
  return {
    symbol,
    price,
    timestamp: ts,
    quality: opts.quality ?? "FRESH",
    change5s: opts.change5s,
    change15s: opts.change15s,
    change1m: opts.change1m,
    change5m: opts.change5m,
    volatility: opts.volatility,
    momentumScore: opts.momentumScore,
  };
}

export class MockCryptoDataAdapter implements CryptoDataAdapter {
  async fetchBtcSnapshot(): Promise<CryptoPriceSnapshot> {
    return snapshot("BTC", 104_380, {
      change5s: 0.0012,
      change15s: 0.0028,
      change1m: 0.0045,
      change5m: 0.008,
      volatility: 0.012,
      momentumScore: 0.62,
    });
  }

  async fetchEthSnapshot(): Promise<CryptoPriceSnapshot> {
    return snapshot("ETH", 3_842, {
      change5s: 0.0008,
      change15s: 0.0015,
      change1m: 0.003,
      change5m: 0.006,
      volatility: 0.015,
      momentumScore: 0.48,
    });
  }
}

/** Stale BTC snapshot for testing. */
export function buildStaleBtcSnapshot(): CryptoPriceSnapshot {
  return snapshot("BTC", 104_000, {
    change5s: 0,
    change15s: 0,
    change1m: 0,
    change5m: 0,
    volatility: 0.01,
    momentumScore: 0,
    quality: "STALE",
    ageMs: 120_000,
  });
}

export function createCryptoDataAdapter(_mockMode: boolean): CryptoDataAdapter {
  return new MockCryptoDataAdapter();
}
