import type {
  DepthAnalysis,
  NormalizedPredictionMarket,
  OpportunityType,
  OrderBookLevel,
} from "./types";

function walkAsks(
  levels: OrderBookLevel[],
  targetSize: number,
): { vwap: number; filled: number } {
  const sorted = [...levels].sort((a, b) => a.price - b.price);
  let remaining = targetSize;
  let cost = 0;
  let filled = 0;
  for (const level of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, level.size);
    cost += take * level.price;
    filled += take;
    remaining -= take;
  }
  if (filled <= 0) return { vwap: 0, filled: 0 };
  return { vwap: cost / filled, filled };
}

function walkBids(
  levels: OrderBookLevel[],
  targetSize: number,
): { vwap: number; filled: number } {
  const sorted = [...levels].sort((a, b) => b.price - a.price);
  let remaining = targetSize;
  let proceeds = 0;
  let filled = 0;
  for (const level of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, level.size);
    proceeds += take * level.price;
    filled += take;
    remaining -= take;
  }
  if (filled <= 0) return { vwap: 0, filled: 0 };
  return { vwap: proceeds / filled, filled };
}

function topOfBookSize(outcomes: NormalizedPredictionMarket["outcomes"], side: "ask" | "bid"): number {
  if (side === "ask") {
    return Math.min(...outcomes.map((o) => o.asks[0]?.size ?? 0));
  }
  return Math.min(...outcomes.map((o) => o.bids[0]?.size ?? 0));
}

/**
 * OrderBookDepthAnalyzer — executable size, VWAP, top-of-book rejection.
 */
export function analyzeOrderBookDepth(input: {
  market: NormalizedPredictionMarket;
  opportunityType: OpportunityType;
  maxNotionalUsd?: number;
}): DepthAnalysis {
  const { market, opportunityType } = input;
  const maxNotional = input.maxNotionalUsd ?? 500;
  const perOutcomeFill: DepthAnalysis["perOutcomeFill"] = [];

  const topSize = topOfBookSize(
    market.outcomes,
    opportunityType === "BUY_BUNDLE" ? "ask" : "bid",
  );

  let limitingSize = Infinity;
  for (const outcome of market.outcomes) {
    const book = opportunityType === "BUY_BUNDLE" ? outcome.asks : outcome.bids;
    const probe = opportunityType === "BUY_BUNDLE" ? walkAsks(book, maxNotional) : walkBids(book, maxNotional);
    perOutcomeFill.push({
      outcomeId: outcome.outcomeId,
      vwap: probe.vwap,
      filledSize: probe.filled,
    });
    limitingSize = Math.min(limitingSize, probe.filled);
  }

  if (!Number.isFinite(limitingSize) || limitingSize <= 0) {
    return {
      executableSizeUsd: 0,
      vwapBundleCost: 0,
      topOfBookOnly: true,
      depthRejected: true,
      depthRejectReason: "Insufficient order book depth on one or more legs.",
      perOutcomeFill,
    };
  }

  const vwapSum = perOutcomeFill.reduce((acc, leg) => acc + leg.vwap, 0);
  const executableSizeUsd = limitingSize;
  const topOfBookOnly = executableSizeUsd <= topSize * 1.01 && topSize < 50;

  let depthRejected = false;
  let depthRejectReason: string | null = null;

  if (executableSizeUsd < 25) {
    depthRejected = true;
    depthRejectReason = "Executable size below $25 minimum.";
  } else if (topOfBookOnly && opportunityType === "BUY_BUNDLE") {
    const topAskSum = market.outcomes.reduce(
      (acc, o) => acc + (o.bestAsk ?? 1),
      0,
    );
    const vwapEdge = 1 - vwapSum;
    const topEdge = 1 - topAskSum;
    if (topEdge > 0 && vwapEdge <= 0) {
      depthRejected = true;
      depthRejectReason =
        "Edge exists only at top-of-book — VWAP fill erases profit.";
    }
  }

  return {
    executableSizeUsd,
    vwapBundleCost: vwapSum,
    topOfBookOnly,
    depthRejected,
    depthRejectReason,
    perOutcomeFill,
  };
}
