import type { PolymarketConfig } from "./config-types";
import { timeRemainingSeconds } from "./market-discovery";
import type { CryptoPriceSnapshot, FairProbabilityResult, PolymarketMarket } from "./types";
import {
  bestAsk,
  bestBid,
  buildOrderBookFromMarket,
  sumAskLiquidity,
  totalBookDepth,
} from "./adapters/mock-order-book-adapter";
import type { OrderBookSnapshot, SweeperOpportunity, SweeperStrategy } from "./sweeper-types";

function newOpportunityId(): string {
  return `swp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function baseOpp(input: {
  market: PolymarketMarket;
  book: OrderBookSnapshot;
  strategy: SweeperStrategy;
  side: SweeperOpportunity["side"];
  suggestedPrice: number;
  secondaryPrice?: number;
  estimatedEdge: number;
  confidence: number;
  suggestedSize: number;
  reason: string;
  riskFlags?: string[];
}): SweeperOpportunity {
  return {
    opportunityId: newOpportunityId(),
    marketId: input.market.marketId,
    strategy: input.strategy,
    side: input.side,
    suggestedPrice: Number(input.suggestedPrice.toFixed(4)),
    secondaryPrice: input.secondaryPrice != null ? Number(input.secondaryPrice.toFixed(4)) : undefined,
    estimatedEdge: Number(input.estimatedEdge.toFixed(4)),
    confidence: Number(input.confidence.toFixed(4)),
    suggestedSizeSimulated: Number(input.suggestedSize.toFixed(2)),
    sweepScore: Number((input.estimatedEdge * input.confidence).toFixed(4)),
    reason: input.reason,
    riskFlags: input.riskFlags ?? [],
    orderBookDepth: totalBookDepth(input.book),
    timeRemainingSeconds: timeRemainingSeconds(input.market),
    status: "OPEN",
    createdAt: new Date().toISOString(),
  };
}

function scanBinaryUnderOneArb(
  market: PolymarketMarket,
  book: OrderBookSnapshot,
  config: PolymarketConfig,
): SweeperOpportunity | null {
  const askYes = bestAsk(book, "YES") ?? market.bestAskYes;
  const askNo = bestAsk(book, "NO") ?? market.bestAskNo;
  const bundleCost = askYes + askNo;
  const edge = 1 - bundleCost;
  if (edge < config.minEdgeThreshold) return null;
  const depth = Math.min(sumAskLiquidity(book, "YES"), sumAskLiquidity(book, "NO"));
  return baseOpp({
    market,
    book,
    strategy: "BINARY_UNDER_ONE_ARB",
    side: "BUNDLE_YES_NO",
    suggestedPrice: askYes,
    secondaryPrice: askNo,
    estimatedEdge: edge,
    confidence: Math.min(0.95, 0.6 + edge * 3),
    suggestedSize: Math.min(config.maxExposurePerMarket, depth * 0.01),
    reason: `Bundle ask YES ${askYes.toFixed(2)} + NO ${askNo.toFixed(2)} = ${bundleCost.toFixed(3)} < $1. Arb edge ${(edge * 100).toFixed(1)}%.`,
  });
}

function scanDumpAndHedge(
  market: PolymarketMarket,
  book: OrderBookSnapshot,
  config: PolymarketConfig,
): SweeperOpportunity | null {
  const bidYes = bestBid(book, "YES") ?? market.bestBidYes;
  const mid = (market.bestBidYes + market.bestAskYes) / 2;
  const dumpPct = (mid - bidYes) / mid;
  if (dumpPct < 0.06) return null;
  const askNo = bestAsk(book, "NO") ?? market.bestAskNo;
  const edge = dumpPct * 0.5 - (askNo - (1 - bidYes)) * 0.1;
  if (edge < config.minEdgeThreshold * 0.8) return null;
  return baseOpp({
    market,
    book,
    strategy: "DUMP_AND_HEDGE",
    side: "BUY_NO",
    suggestedPrice: askNo,
    estimatedEdge: Math.max(edge, config.minEdgeThreshold),
    confidence: 0.58,
    suggestedSize: Math.min(config.maxExposurePerMarket * 0.5, market.liquidity * 0.008),
    reason: `YES dump ${(dumpPct * 100).toFixed(1)}% vs mid — hedge via NO at ${askNo.toFixed(2)}.`,
    riskFlags: dumpPct > 0.12 ? ["HIGH_DUMP_VOLATILITY"] : [],
  });
}

function scanWideSpreadCapture(
  market: PolymarketMarket,
  book: OrderBookSnapshot,
  config: PolymarketConfig,
): SweeperOpportunity | null {
  const bid = bestBid(book, "YES") ?? market.bestBidYes;
  const ask = bestAsk(book, "YES") ?? market.bestAskYes;
  const spread = ask - bid;
  if (spread < config.maxSpread * 0.75) return null;
  const edge = spread * 0.45;
  if (edge < config.minEdgeThreshold) return null;
  return baseOpp({
    market,
    book,
    strategy: "WIDE_SPREAD_CAPTURE",
    side: "BUY_YES",
    suggestedPrice: bid + spread * 0.25,
    estimatedEdge: edge,
    confidence: Math.min(0.7, 0.45 + spread),
    suggestedSize: Math.min(config.maxExposurePerMarket * 0.3, market.liquidity * 0.005),
    reason: `Wide YES spread ${spread.toFixed(3)} — simulated capture between bid/ask.`,
    riskFlags: spread > config.maxSpread ? ["WIDE_SPREAD"] : [],
  });
}

function scanCryptoMarketLag(
  market: PolymarketMarket,
  book: OrderBookSnapshot,
  fair: FairProbabilityResult | undefined,
  btc: CryptoPriceSnapshot,
  eth: CryptoPriceSnapshot,
  config: PolymarketConfig,
): SweeperOpportunity | null {
  if (!fair || (market.asset !== "BTC" && market.asset !== "ETH")) return null;
  const crypto = market.asset === "ETH" ? eth : btc;
  if (crypto.quality !== "FRESH") return null;
  const askYes = bestAsk(book, "YES") ?? market.bestAskYes;
  const lagEdge = fair.fairProbabilityYes - askYes;
  if (lagEdge < config.minEdgeThreshold) return null;
  if (Math.abs(crypto.change15s) < 0.001) return null;
  return baseOpp({
    market,
    book,
    strategy: "CRYPTO_MARKET_LAG",
    side: "BUY_YES",
    suggestedPrice: askYes,
    estimatedEdge: lagEdge,
    confidence: fair.confidenceScore * 0.9,
    suggestedSize: Math.min(config.maxExposurePerMarket, market.liquidity * 0.01),
    reason: `Polymarket YES ${askYes.toFixed(2)} lags fair ${fair.fairProbabilityYes.toFixed(2)} after ${market.asset} move ${(crypto.change15s * 100).toFixed(2)}%/15s.`,
    riskFlags: ["LATENCY_RISK"],
  });
}

function scanNearExpiryLiquidityGap(
  market: PolymarketMarket,
  book: OrderBookSnapshot,
  config: PolymarketConfig,
): SweeperOpportunity | null {
  const timeRem = timeRemainingSeconds(market);
  if (timeRem > 900 || timeRem < config.minTimeRemainingSeconds) return null;
  const spread = (bestAsk(book, "YES") ?? market.bestAskYes) - (bestBid(book, "YES") ?? market.bestBidYes);
  const thin = totalBookDepth(book) < config.minLiquidity * 2;
  if (!thin && spread < config.maxSpread) return null;
  const edge = spread * 0.35 + (thin ? 0.02 : 0);
  if (edge < config.minEdgeThreshold * 0.7) return null;
  return baseOpp({
    market,
    book,
    strategy: "NEAR_EXPIRY_LIQUIDITY_GAP",
    side: "BUY_YES",
    suggestedPrice: market.bestAskYes,
    estimatedEdge: edge,
    confidence: 0.52,
    suggestedSize: Math.min(config.maxExposurePerMarket * 0.25, market.liquidity * 0.005),
    reason: `${timeRem}s to expiry — thin book / gap (spread ${spread.toFixed(3)}, depth ${totalBookDepth(book).toFixed(0)}).`,
    riskFlags: ["NEAR_EXPIRY", thin ? "LOW_LIQUIDITY" : "WIDE_SPREAD"],
  });
}

export function scanSweeperOpportunities(input: {
  markets: PolymarketMarket[];
  fairPrices: FairProbabilityResult[];
  btc: CryptoPriceSnapshot;
  eth: CryptoPriceSnapshot;
  config: PolymarketConfig;
  books?: OrderBookSnapshot[];
}): SweeperOpportunity[] {
  const fairById = new Map(input.fairPrices.map((f) => [f.marketId, f]));
  const opportunities: SweeperOpportunity[] = [];

  for (const market of input.markets) {
    const book = input.books?.find((b) => b.marketId === market.marketId) ?? buildOrderBookFromMarket(market);
    const fair = fairById.get(market.marketId);

    const scanners = [
      scanBinaryUnderOneArb(market, book, input.config),
      scanDumpAndHedge(market, book, input.config),
      scanWideSpreadCapture(market, book, input.config),
      scanCryptoMarketLag(market, book, fair, input.btc, input.eth, input.config),
      scanNearExpiryLiquidityGap(market, book, input.config),
    ];

    for (const opp of scanners) {
      if (opp) opportunities.push(opp);
    }
  }

  return opportunities.sort((a, b) => b.sweepScore - a.sweepScore);
}

export const SWEEPER_STRATEGIES: SweeperStrategy[] = [
  "BINARY_UNDER_ONE_ARB",
  "DUMP_AND_HEDGE",
  "WIDE_SPREAD_CAPTURE",
  "CRYPTO_MARKET_LAG",
  "NEAR_EXPIRY_LIQUIDITY_GAP",
];
