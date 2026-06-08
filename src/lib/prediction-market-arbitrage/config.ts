import type { OrderBookLevel } from "./types";

export const PREDICTION_ARB_DEFAULTS = {
  /** Minimum executable edge after fees + slippage (percent). */
  minExecutableEdgePct: 0.75,
  /** Minimum theoretical deviation from parity to flag (percent). */
  minTheoreticalEdgePct: 0.35,
  /** Taker fee assumption per leg (percent). */
  takerFeePct: 0.2,
  /** Default slippage buffer (bps). */
  slippageBps: 15,
  /** Max resolution risk score (0–100) before block. */
  maxResolutionRiskScore: 55,
  /** Simulated latency ms. */
  latencyMs: 350,
  /** Portfolio cap per opportunity (USD, paper). */
  maxCapitalPerOpportunityUsd: 500,
  /** Total paper capital budget. */
  portfolioBudgetUsd: 2_500,
  /** Stale book threshold seconds. */
  staleBookSeconds: 120,
  /** Partial fill worst-case ratio. */
  partialFillMinRatio: 0.65,
};

export function bestBid(levels: OrderBookLevel[]): number | null {
  if (levels.length === 0) return null;
  return Math.max(...levels.map((l) => l.price));
}

export function bestAsk(levels: OrderBookLevel[]): number | null {
  if (levels.length === 0) return null;
  return Math.min(...levels.map((l) => l.price));
}

export function midPrice(bid: number | null, ask: number | null): number | null {
  if (bid === null || ask === null) return null;
  return (bid + ask) / 2;
}
