import {
  bestAsk,
  bestBid,
  midPrice,
  PREDICTION_ARB_DEFAULTS,
} from "./config";
import type {
  NormalizedPredictionMarket,
  OrderBookLevel,
  OutcomeBook,
} from "./types";

const GAMMA_API = "https://gamma-api.polymarket.com/markets";
const FETCH_TIMEOUT_MS = 8_000;

function buildOutcomeBook(input: {
  outcomeId: string;
  outcomeLabel: string;
  role: OutcomeBook["role"];
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}): OutcomeBook {
  const bestBidPx = bestBid(input.bids);
  const bestAskPx = bestAsk(input.asks);
  return {
    outcomeId: input.outcomeId,
    outcomeLabel: input.outcomeLabel,
    role: input.role,
    bids: input.bids,
    asks: input.asks,
    bestBid: bestBidPx,
    bestAsk: bestAskPx,
    mid: midPrice(bestBidPx, bestAskPx),
  };
}

/** Curated mock markets for offline / test / API fallback. */
export function getMockPredictionMarkets(): NormalizedPredictionMarket[] {
  const now = new Date().toISOString();
  const fee = PREDICTION_ARB_DEFAULTS.takerFeePct / 100;
  const slip = PREDICTION_ARB_DEFAULTS.slippageBps;

  return [
    {
      id: "mock-btc-100k-binary",
      eventId: "evt-btc-100k",
      eventTitle: "Bitcoin above $100k by Dec 2026?",
      marketTitle: "BTC > $100k Dec 2026",
      marketType: "BINARY",
      mutuallyExclusive: true,
      resolutionRules:
        "Resolves YES if Binance BTCUSDT daily close exceeds $100,000 on or before 2026-12-31 UTC. " +
        "Otherwise NO. Oracle: UMA optimistic oracle.",
      resolutionDeadline: "2026-12-31T23:59:59Z",
      feeRate: fee,
      slippageBps: slip,
      source: "mock",
      fetchedAt: now,
      outcomes: [
        buildOutcomeBook({
          outcomeId: "yes",
          outcomeLabel: "Yes",
          role: "YES",
          bids: [
            { price: 0.41, size: 800 },
            { price: 0.405, size: 1200 },
          ],
          asks: [
            { price: 0.415, size: 600 },
            { price: 0.42, size: 900 },
          ],
        }),
        buildOutcomeBook({
          outcomeId: "no",
          outcomeLabel: "No",
          role: "NO",
          bids: [
            { price: 0.555, size: 700 },
            { price: 0.55, size: 1100 },
          ],
          asks: [
            { price: 0.56, size: 500 },
            { price: 0.565, size: 850 },
          ],
        }),
      ],
    },
    {
      id: "mock-fed-rates-multi",
      eventId: "evt-fed-rates",
      eventTitle: "Fed decision March 2026",
      marketTitle: "March 2026 Fed rate outcome",
      marketType: "MULTI_OUTCOME",
      mutuallyExclusive: true,
      resolutionRules:
        "Resolves to the official FOMC statement target range announced at the March 2026 meeting. " +
        "Mutually exclusive outcomes. Subject to Polymarket admin review in edge cases.",
      resolutionDeadline: "2026-03-19T20:00:00Z",
      feeRate: fee,
      slippageBps: slip,
      source: "mock",
      fetchedAt: now,
      outcomes: [
        buildOutcomeBook({
          outcomeId: "cut-50",
          outcomeLabel: "Cut 50bps",
          role: "OUTCOME",
          bids: [{ price: 0.08, size: 400 }, { price: 0.075, size: 600 }],
          asks: [{ price: 0.085, size: 350 }, { price: 0.09, size: 500 }],
        }),
        buildOutcomeBook({
          outcomeId: "cut-25",
          outcomeLabel: "Cut 25bps",
          role: "OUTCOME",
          bids: [{ price: 0.34, size: 500 }, { price: 0.335, size: 700 }],
          asks: [{ price: 0.345, size: 450 }, { price: 0.35, size: 650 }],
        }),
        buildOutcomeBook({
          outcomeId: "hold",
          outcomeLabel: "Hold",
          role: "OUTCOME",
          bids: [{ price: 0.48, size: 600 }, { price: 0.475, size: 800 }],
          asks: [{ price: 0.485, size: 550 }, { price: 0.49, size: 750 }],
        }),
        buildOutcomeBook({
          outcomeId: "hike",
          outcomeLabel: "Hike",
          role: "OUTCOME",
          bids: [{ price: 0.14, size: 300 }],
          asks: [{ price: 0.145, size: 280 }, { price: 0.15, size: 400 }],
        }),
      ],
    },
    {
      id: "mock-eth-merge-binary-tight",
      eventId: "evt-eth-etf",
      eventTitle: "ETH spot ETF net inflows positive this week?",
      marketTitle: "ETH ETF weekly inflows",
      marketType: "BINARY",
      mutuallyExclusive: true,
      resolutionRules:
        "Resolves YES if aggregate reported spot ETH ETF net inflows are positive for the calendar week. " +
        "Data source may be revised; ambiguous wording possible.",
      resolutionDeadline: "2026-06-14T23:59:59Z",
      feeRate: fee,
      slippageBps: slip,
      source: "mock",
      fetchedAt: now,
      outcomes: [
        buildOutcomeBook({
          outcomeId: "yes",
          outcomeLabel: "Yes",
          role: "YES",
          bids: [{ price: 0.62, size: 200 }],
          asks: [{ price: 0.625, size: 180 }],
        }),
        buildOutcomeBook({
          outcomeId: "no",
          outcomeLabel: "No",
          role: "NO",
          bids: [{ price: 0.365, size: 200 }],
          asks: [{ price: 0.37, size: 180 }],
        }),
      ],
    },
  ];
}

interface GammaMarketRow {
  id?: string | number;
  question?: string;
  groupItemTitle?: string;
  endDate?: string;
  description?: string;
  outcomes?: string;
  outcomePrices?: string;
  clobTokenIds?: string;
  active?: boolean;
  closed?: boolean;
}

function parseJsonArray(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function syntheticBook(mid: number, liquidity = 400): OutcomeBook {
  const spread = 0.02;
  const bid = Math.max(0.01, mid - spread / 2);
  const ask = Math.min(0.99, mid + spread / 2);
  return buildOutcomeBook({
    outcomeId: `syn-${mid}`,
    outcomeLabel: `Outcome @ ${mid.toFixed(2)}`,
    role: "OUTCOME",
    bids: [{ price: bid, size: liquidity }],
    asks: [{ price: ask, size: liquidity }],
  });
}

function normalizeGammaMarket(row: GammaMarketRow): NormalizedPredictionMarket | null {
  const labels = parseJsonArray(row.outcomes);
  const prices = parseJsonArray(row.outcomePrices).map(Number);
  if (labels.length < 2 || prices.length < 2) return null;
  if (row.closed || row.active === false) return null;

  const fee = PREDICTION_ARB_DEFAULTS.takerFeePct / 100;
  const marketType: NormalizedPredictionMarket["marketType"] =
    labels.length === 2 ? "BINARY" : "MULTI_OUTCOME";

  const outcomes: OutcomeBook[] = labels.map((label, i) => {
    const mid = Number.isFinite(prices[i]) ? prices[i] : 0.5;
    const role: OutcomeBook["role"] =
      marketType === "BINARY"
        ? label.toLowerCase().includes("yes")
          ? "YES"
          : "NO"
        : "OUTCOME";
    return buildOutcomeBook({
      outcomeId: `${row.id}-${i}`,
      outcomeLabel: label,
      role,
      bids: [{ price: Math.max(0.01, mid - 0.015), size: 300 }],
      asks: [{ price: Math.min(0.99, mid + 0.015), size: 300 }],
    });
  });

  return {
    id: String(row.id ?? `gamma-${Date.now()}`),
    eventId: String(row.id ?? "unknown"),
    eventTitle: row.question ?? "Polymarket event",
    marketTitle: row.groupItemTitle ?? row.question ?? "Market",
    marketType,
    outcomes,
    resolutionRules: row.description ?? "See Polymarket market rules.",
    resolutionDeadline: row.endDate ?? null,
    mutuallyExclusive: true,
    feeRate: fee,
    slippageBps: PREDICTION_ARB_DEFAULTS.slippageBps,
    source: "polymarket",
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchPolymarketMarkets(limit = 12): Promise<NormalizedPredictionMarket[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = `${GAMMA_API}?active=true&closed=false&limit=${limit}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as GammaMarketRow[];
    return rows
      .map(normalizeGammaMarket)
      .filter((m): m is NormalizedPredictionMarket => m !== null);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export interface MarketDataConnectorResult {
  markets: NormalizedPredictionMarket[];
  dataSource: "live" | "mock" | "mixed";
}

/**
 * MarketDataConnector — public API first, mock fallback.
 * Normalizes all markets into a common schema.
 */
export async function fetchPredictionMarkets(input?: {
  preferLive?: boolean;
  mockOnly?: boolean;
}): Promise<MarketDataConnectorResult> {
  if (input?.mockOnly) {
    return { markets: getMockPredictionMarkets(), dataSource: "mock" };
  }

  const live = input?.preferLive !== false ? await fetchPolymarketMarkets() : [];
  if (live.length === 0) {
    return { markets: getMockPredictionMarkets(), dataSource: "mock" };
  }

  const mock = getMockPredictionMarkets();
  const seen = new Set(live.map((m) => m.id));
  const merged = [...live, ...mock.filter((m) => !seen.has(m.id))];
  return {
    markets: merged,
    dataSource: live.length > 0 && mock.length > 0 ? "mixed" : "live",
  };
}

export { syntheticBook, buildOutcomeBook };
