import type { CryptoPriceSnapshot, PolymarketMarket } from "../types";

export interface PolymarketAdapter {
  fetchCryptoMarkets(): Promise<PolymarketMarket[]>;
}

export interface CryptoDataAdapter {
  fetchBtcSnapshot(): Promise<CryptoPriceSnapshot>;
  fetchEthSnapshot(): Promise<CryptoPriceSnapshot>;
}
