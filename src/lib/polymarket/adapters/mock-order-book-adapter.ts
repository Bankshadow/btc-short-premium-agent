import type { PolymarketMarket } from "../types";
import type { OrderBookLevel, OrderBookSnapshot } from "../sweeper-types";

function level(
  outcome: "YES" | "NO",
  side: "BID" | "ASK",
  price: number,
  size: number,
): OrderBookLevel {
  return { outcome, side, price, size };
}

/** Build mock multi-level order book from market top-of-book. */
export function buildOrderBookFromMarket(market: PolymarketMarket): OrderBookSnapshot {
  const levels: OrderBookLevel[] = [];
  const yesBid = market.bestBidYes;
  const yesAsk = market.bestAskYes;
  const noBid = market.bestBidNo;
  const noAsk = market.bestAskNo;
  const depth = Math.max(50, market.liquidity * 0.005);

  levels.push(level("YES", "BID", yesBid, depth));
  levels.push(level("YES", "ASK", yesAsk, depth * 0.9));
  levels.push(level("NO", "BID", noBid, depth * 0.85));
  levels.push(level("NO", "ASK", noAsk, depth * 0.8));

  // Deeper levels for sweep simulation
  levels.push(level("YES", "BID", Number((yesBid - 0.01).toFixed(3)), depth * 0.5));
  levels.push(level("YES", "ASK", Number((yesAsk + 0.01).toFixed(3)), depth * 0.4));
  levels.push(level("NO", "BID", Number((noBid - 0.01).toFixed(3)), depth * 0.45));
  levels.push(level("NO", "ASK", Number((noAsk + 0.01).toFixed(3)), depth * 0.35));

  // Inject arb scenario for specific mock market
  if (market.marketId === "pm-binary-arb-mock") {
    levels.push(level("YES", "ASK", 0.46, 800));
    levels.push(level("NO", "ASK", 0.48, 750));
  }

  // Inject dump scenario
  if (market.marketId === "pm-btc-dump-hedge") {
    levels.push(level("YES", "BID", 0.32, 1200));
    levels.push(level("YES", "ASK", 0.35, 900));
    levels.push(level("NO", "BID", 0.62, 1100));
    levels.push(level("NO", "ASK", 0.65, 950));
  }

  return {
    marketId: market.marketId,
    levels,
    capturedAt: market.capturedAt,
  };
}

export function buildOrderBooks(markets: PolymarketMarket[]): OrderBookSnapshot[] {
  return markets.map(buildOrderBookFromMarket);
}

export function sumAskLiquidity(book: OrderBookSnapshot, outcome: "YES" | "NO"): number {
  return book.levels
    .filter((l) => l.outcome === outcome && l.side === "ASK")
    .reduce((s, l) => s + l.size, 0);
}

export function bestAsk(book: OrderBookSnapshot, outcome: "YES" | "NO"): number | null {
  const asks = book.levels.filter((l) => l.outcome === outcome && l.side === "ASK");
  if (asks.length === 0) return null;
  return Math.min(...asks.map((a) => a.price));
}

export function bestBid(book: OrderBookSnapshot, outcome: "YES" | "NO"): number | null {
  const bids = book.levels.filter((l) => l.outcome === outcome && l.side === "BID");
  if (bids.length === 0) return null;
  return Math.max(...bids.map((b) => b.price));
}

export function totalBookDepth(book: OrderBookSnapshot): number {
  return book.levels.reduce((s, l) => s + l.size, 0);
}
