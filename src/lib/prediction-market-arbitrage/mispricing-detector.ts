import { PREDICTION_ARB_DEFAULTS } from "./config";
import type {
  NormalizedPredictionMarket,
  OpportunityType,
  RawMispricingCandidate,
} from "./types";

function sumAsks(outcomes: NormalizedPredictionMarket["outcomes"]): number | null {
  let sum = 0;
  for (const o of outcomes) {
    if (o.bestAsk === null) return null;
    sum += o.bestAsk;
  }
  return sum;
}

function sumBids(outcomes: NormalizedPredictionMarket["outcomes"]): number | null {
  let sum = 0;
  for (const o of outcomes) {
    if (o.bestBid === null) return null;
    sum += o.bestBid;
  }
  return sum;
}

function sumMids(outcomes: NormalizedPredictionMarket["outcomes"]): number | null {
  let sum = 0;
  for (const o of outcomes) {
    if (o.mid === null) return null;
    sum += o.mid;
  }
  return sum;
}

/**
 * MispricingDetector — binary YES+NO and multi-outcome parity checks.
 */
export function detectMispricing(
  market: NormalizedPredictionMarket,
  config: typeof PREDICTION_ARB_DEFAULTS = PREDICTION_ARB_DEFAULTS,
): RawMispricingCandidate[] {
  const candidates: RawMispricingCandidate[] = [];
  const feePct = (market.feeRate * 100 * market.outcomes.length) / Math.max(1, market.outcomes.length);
  const slipPct = market.slippageBps / 100;

  const askSum = sumAsks(market.outcomes);
  const bidSum = sumBids(market.outcomes);
  const midSum = sumMids(market.outcomes);

  if (askSum !== null && askSum < 1) {
    const deviation = 1 - askSum;
    const edgePct = deviation * 100 - feePct - slipPct;
    if (edgePct >= config.minTheoreticalEdgePct) {
      candidates.push({
        market,
        opportunityType: "BUY_BUNDLE",
        theoreticalEdgePct: edgePct,
        priceSum: askSum,
        deviationFromParity: deviation,
        reasons: [
          `Ask bundle ${askSum.toFixed(4)} < 1.00 — buy-all-outcomes arb (theoretical).`,
          `Fees ~${feePct.toFixed(2)}% · slippage ~${slipPct.toFixed(2)}%.`,
        ],
      });
    }
  }

  if (bidSum !== null && bidSum > 1 && market.mutuallyExclusive) {
    const deviation = bidSum - 1;
    const edgePct = deviation * 100 - feePct - slipPct;
    if (edgePct >= config.minTheoreticalEdgePct) {
      candidates.push({
        market,
        opportunityType: "SELL_BUNDLE",
        theoreticalEdgePct: edgePct,
        priceSum: bidSum,
        deviationFromParity: deviation,
        reasons: [
          `Bid bundle ${bidSum.toFixed(4)} > 1.00 — sell-all-outcomes arb (theoretical).`,
          `Requires shorting / inventory on all legs.`,
        ],
      });
    }
  }

  if (candidates.length === 0 && midSum !== null) {
    const deviation = Math.abs(1 - midSum);
    const edgePct = deviation * 100;
    if (edgePct >= config.minTheoreticalEdgePct * 1.5) {
      candidates.push({
        market,
        opportunityType: midSum < 1 ? "BUY_BUNDLE" : "SELL_BUNDLE",
        theoreticalEdgePct: edgePct - feePct,
        priceSum: midSum,
        deviationFromParity: deviation,
        reasons: [
          `Mid-price sum ${midSum.toFixed(4)} deviates from parity — monitor only until book depth confirms.`,
        ],
      });
    }
  }

  if (market.marketType === "BINARY" && market.outcomes.length === 2) {
    const yes = market.outcomes.find((o) => o.role === "YES") ?? market.outcomes[0];
    const no = market.outcomes.find((o) => o.role === "NO") ?? market.outcomes[1];
    const yesMid = yes.mid ?? 0;
    const noMid = no.mid ?? 0;
    const binarySum = yesMid + noMid;
    if (Math.abs(1 - binarySum) >= config.minTheoreticalEdgePct / 100) {
      const existing = candidates.some((c) => c.market.id === market.id);
      if (!existing) {
        candidates.push({
          market,
          opportunityType: binarySum < 1 ? "BUY_BUNDLE" : "SELL_BUNDLE",
          theoreticalEdgePct: Math.abs(1 - binarySum) * 100 - feePct,
          priceSum: binarySum,
          deviationFromParity: Math.abs(1 - binarySum),
          reasons: [`Binary YES+NO mid sum ${binarySum.toFixed(4)} ≠ 1.00.`],
        });
      }
    }
  }

  return candidates;
}

export function detectAllMispricing(
  markets: NormalizedPredictionMarket[],
  config: typeof PREDICTION_ARB_DEFAULTS = PREDICTION_ARB_DEFAULTS,
): RawMispricingCandidate[] {
  return markets.flatMap((m) => detectMispricing(m, config));
}
