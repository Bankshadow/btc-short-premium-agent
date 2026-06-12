import type { PolymarketAdapter } from "./adapters/adapter-types";
import type { PolymarketMarket } from "./types";

const CRYPTO_KEYWORDS = [
  "btc",
  "bitcoin",
  "eth",
  "ethereum",
  "crypto",
  "up",
  "down",
  "above",
  "below",
  "price",
];

export function isCryptoRelatedMarket(market: PolymarketMarket): boolean {
  const haystack = `${market.question} ${market.slug} ${market.asset}`.toLowerCase();
  return (
    market.asset !== "CRYPTO" ||
    CRYPTO_KEYWORDS.some((k) => haystack.includes(k))
  );
}

export function filterCryptoMarkets(markets: PolymarketMarket[]): PolymarketMarket[] {
  return markets.filter(
    (m) =>
      m.status === "ACTIVE" &&
      (m.asset === "BTC" || m.asset === "ETH" || m.asset === "CRYPTO") &&
      isCryptoRelatedMarket(m),
  );
}

export async function discoverCryptoPolymarketMarkets(
  adapter: PolymarketAdapter,
): Promise<PolymarketMarket[]> {
  const all = await adapter.fetchCryptoMarkets();
  return filterCryptoMarkets(all);
}

export function timeRemainingSeconds(market: PolymarketMarket, now = Date.now()): number {
  const end = Date.parse(market.endTime);
  if (!Number.isFinite(end)) return 0;
  return Math.max(0, Math.floor((end - now) / 1000));
}
