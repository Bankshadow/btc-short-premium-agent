/** Seeded-ish PRNG for reproducible Monte Carlo batches. */
export function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MonteCarloRunResult {
  endingEquity: number;
  maxDrawdownPct: number;
  reachedTarget: boolean;
  ruined: boolean;
  trades: number;
}

export function runSingleEquityPath(input: {
  startEquity: number;
  targetEquity: number;
  ruinFloor: number;
  winRate: number;
  avgWinR: number;
  avgLossR: number;
  riskPct: number;
  maxTrades: number;
  rand: () => number;
}): MonteCarloRunResult {
  let equity = input.startEquity;
  let peak = equity;
  let maxDd = 0;
  let trades = 0;

  for (let t = 0; t < input.maxTrades; t++) {
    if (equity <= input.ruinFloor) {
      return {
        endingEquity: equity,
        maxDrawdownPct: maxDd,
        reachedTarget: false,
        ruined: true,
        trades,
      };
    }
    if (equity >= input.targetEquity) {
      return {
        endingEquity: equity,
        maxDrawdownPct: maxDd,
        reachedTarget: true,
        ruined: false,
        trades,
      };
    }

    const win = input.rand() < input.winRate;
    const r = win ? input.avgWinR : -Math.abs(input.avgLossR);
    const pnlPct = (input.riskPct / 100) * r;
    equity *= 1 + pnlPct / 100;
    trades += 1;
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    if (dd > maxDd) maxDd = dd;
  }

  return {
    endingEquity: equity,
    maxDrawdownPct: maxDd,
    reachedTarget: equity >= input.targetEquity,
    ruined: equity <= input.ruinFloor,
    trades,
  };
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}
