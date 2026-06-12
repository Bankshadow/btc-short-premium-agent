import { timeRemainingSeconds } from "./market-discovery";
import type { CryptoPriceSnapshot, FairProbabilityResult, PolymarketMarket } from "./types";

function clamp01(n: number): number {
  return Math.max(0.01, Math.min(0.99, n));
}

function pickCryptoSnapshot(
  market: PolymarketMarket,
  btc: CryptoPriceSnapshot,
  eth: CryptoPriceSnapshot,
): CryptoPriceSnapshot | null {
  if (market.asset === "BTC") return btc;
  if (market.asset === "ETH") return eth;
  if (market.asset === "CRYPTO") return btc;
  return null;
}

export function estimateFairProbability(input: {
  market: PolymarketMarket;
  btc: CryptoPriceSnapshot;
  eth: CryptoPriceSnapshot;
  now?: number;
}): FairProbabilityResult {
  const { market } = input;
  const now = input.now ?? Date.now();
  const crypto = pickCryptoSnapshot(market, input.btc, input.eth);
  const assumptions: string[] = [];
  let fairYes = 0.5;
  let confidence = 0.5;
  let modelReason = "Baseline 50/50 — insufficient structure.";

  const timeRem = timeRemainingSeconds(market, now);
  const timeRemMinutes = timeRem / 60;

  if (!crypto) {
    return {
      marketId: market.marketId,
      fairProbabilityYes: 0.5,
      fairProbabilityNo: 0.5,
      confidenceScore: 0.2,
      modelReason: "No mapped crypto asset for fair price model.",
      assumptions: ["Generic crypto index unavailable."],
      timestamp: new Date(now).toISOString(),
    };
  }

  if (crypto.quality !== "FRESH") {
    confidence -= 0.25;
    assumptions.push("External crypto feed is stale or degraded.");
  }

  if (market.marketType === "UP_DOWN") {
    const ref = market.referencePrice ?? crypto.price;
    const moveFromRef = (crypto.price - ref) / ref;
    fairYes = 0.5 + moveFromRef * 8 + crypto.momentumScore * 0.15;
    if (crypto.change1m > 0.002) fairYes += 0.05;
    if (crypto.change1m < -0.002) fairYes -= 0.05;
    modelReason = "Up/Down model: reference move + 1m momentum.";
    assumptions.push(`Reference ${ref}, spot ${crypto.price}, 1m change ${(crypto.change1m * 100).toFixed(2)}%.`);
  } else if (market.marketType === "ABOVE_BELOW" || market.marketType === "PRICE_TARGET") {
    const strike = market.strikePrice ?? crypto.price;
    const distancePct = (crypto.price - strike) / strike;
    fairYes = 0.5 + distancePct * 5;
    if (crypto.price > strike) {
      fairYes += 0.08;
      assumptions.push("Spot already above strike.");
    } else {
      fairYes -= 0.05;
      assumptions.push("Spot below strike.");
    }
    if (crypto.momentumScore > 0.55 && crypto.price < strike) fairYes += 0.06;
    modelReason = "Above/below model: distance to strike + momentum.";
    assumptions.push(`Strike ${strike}, spot ${crypto.price}, distance ${(distancePct * 100).toFixed(2)}%.`);
  } else {
    fairYes = 0.5 + (crypto.momentumScore - 0.5) * 0.2;
    modelReason = "Generic crypto sentiment proxy from momentum.";
    assumptions.push("Non-price-target market — low structural edge.");
    confidence -= 0.1;
  }

  if (timeRemMinutes < 5) {
    fairYes += crypto.price > (market.referencePrice ?? crypto.price) ? 0.1 : -0.1;
    confidence -= 0.08;
    assumptions.push("Short time remaining increases path dependency.");
  }

  if (crypto.volatility > 0.02) {
    confidence -= 0.1;
    assumptions.push("Elevated volatility reduces model confidence.");
  }

  const spread = market.bestAskYes - market.bestBidYes;
  if (spread > 0.06) {
    confidence -= 0.12;
    assumptions.push("Wide Polymarket spread reduces confidence.");
  }

  fairYes = clamp01(fairYes);
  confidence = clamp01(confidence);

  return {
    marketId: market.marketId,
    fairProbabilityYes: Number(fairYes.toFixed(4)),
    fairProbabilityNo: Number((1 - fairYes).toFixed(4)),
    confidenceScore: Number(confidence.toFixed(4)),
    modelReason,
    assumptions,
    timestamp: new Date(now).toISOString(),
  };
}

export function estimateFairProbabilities(input: {
  markets: PolymarketMarket[];
  btc: CryptoPriceSnapshot;
  eth: CryptoPriceSnapshot;
}): FairProbabilityResult[] {
  return input.markets.map((market) =>
    estimateFairProbability({ market, btc: input.btc, eth: input.eth }),
  );
}
