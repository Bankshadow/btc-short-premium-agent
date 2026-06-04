import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import { ALL_STRATEGY_IDS, STRATEGY_LABELS, VALIDATION_THRESHOLDS } from "./validation-config";
import { strategiesSignaledOnEntry, primaryStrategyForPaper } from "./classify-strategy";
import { resolveStrategyStatus } from "./agent-promotion";
import type { StrategyId, StrategyPerformanceRow } from "./validation-types";

interface StrategyAccumulator {
  signals: number;
  resolved: number;
  wins: number;
  losses: number;
  grossWin: number;
  grossLoss: number;
  pnlSeries: number[];
  falsePositives: number;
  falseNegatives: number;
  correctSkips: number;
  regimePnl: Map<string, { wins: number; losses: number; net: number; n: number }>;
}

function emptyAcc(): StrategyAccumulator {
  return {
    signals: 0,
    resolved: 0,
    wins: 0,
    losses: 0,
    grossWin: 0,
    grossLoss: 0,
    pnlSeries: [],
    falsePositives: 0,
    falseNegatives: 0,
    correctSkips: 0,
    regimePnl: new Map(),
  };
}

function maxDrawdown(series: number[]): number {
  if (series.length === 0) return 0;
  let peak = 0;
  let equity = 0;
  let maxDd = 0;
  for (const r of series) {
    equity += r;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDd) maxDd = dd;
  }
  return maxDd;
}

function recordRegime(
  acc: StrategyAccumulator,
  regime: string,
  pnl: number,
  win: boolean,
) {
  const row = acc.regimePnl.get(regime) ?? { wins: 0, losses: 0, net: 0, n: 0 };
  row.n += 1;
  row.net += pnl;
  if (win) row.wins += 1;
  else row.losses += 1;
  acc.regimePnl.set(regime, row);
}

function bestWorstRegime(acc: StrategyAccumulator): {
  best: string;
  worst: string;
} {
  let best = "—";
  let worst = "—";
  let bestNet = -Infinity;
  let worstNet = Infinity;
  for (const [regime, stats] of acc.regimePnl) {
    if (stats.n < 2) continue;
    if (stats.net > bestNet) {
      bestNet = stats.net;
      best = regime;
    }
    if (stats.net < worstNet) {
      worstNet = stats.net;
      worst = regime;
    }
  }
  return { best, worst };
}

export function buildStrategyPerformanceMatrix(
  entries: DecisionLogEntry[],
  orders: PaperOrder[],
  riskProfile: DeskRiskProfile,
): StrategyPerformanceRow[] {
  const acc = new Map<StrategyId, StrategyAccumulator>();
  for (const id of ALL_STRATEGY_IDS) acc.set(id, emptyAcc());

  for (const entry of entries) {
    const signaled = strategiesSignaledOnEntry(entry);
    const resolved = entry.outcomeStatus === "RESOLVED";
    const pnl = entry.paperPnl ?? 0;
    const tradeWouldWin = entry.resolution?.tradeWouldWin ?? null;

    for (const sid of signaled) {
      const a = acc.get(sid)!;
      a.signals += 1;

      if (resolved && entry.finalVerdict === "TRADE") {
        a.resolved += 1;
        a.pnlSeries.push(pnl);
        const win = pnl > 0 || tradeWouldWin === true;
        if (win) {
          a.wins += 1;
          a.grossWin += Math.max(pnl, 0.01);
        } else {
          a.losses += 1;
          a.grossLoss += Math.abs(Math.min(pnl, -0.01));
        }
        recordRegime(a, entry.marketRegime, pnl, win);
        if (!win && tradeWouldWin === false) a.falsePositives += 1;
      }

      if (resolved && entry.finalVerdict !== "TRADE" && tradeWouldWin === true) {
        a.falseNegatives += 1;
      }
      if (
        resolved &&
        (entry.finalVerdict === "SKIP" || entry.finalVerdict === "WAIT") &&
        tradeWouldWin === false
      ) {
        a.correctSkips += 1;
      }
    }

  }

  for (const order of orders.filter((o) => o.status === "CLOSED")) {
    const sid = primaryStrategyForPaper(order.instrument, order.side);
    const a = acc.get(sid)!;
    const pnl = order.realizedPnlPct ?? 0;
    a.pnlSeries.push(pnl);
    if (pnl > 0) a.grossWin += pnl;
    else a.grossLoss += Math.abs(pnl);
  }

  return ALL_STRATEGY_IDS.map((id) => {
    const a = acc.get(id)!;
    const winRate =
      a.resolved > 0 ? Math.round((a.wins / a.resolved) * 100) : 0;
    const averageR =
      a.resolved > 0
        ? Number(
            (a.pnlSeries.reduce((s, x) => s + x, 0) / a.resolved).toFixed(2),
          )
        : 0;
    const profitFactor =
      a.grossLoss > 0
        ? Number((a.grossWin / a.grossLoss).toFixed(2))
        : a.grossWin > 0
          ? 99
          : 0;
    const maxDrawdownPct = Number(maxDrawdown(a.pnlSeries).toFixed(2));
    const { best, worst } = bestWorstRegime(a);
    const status = resolveStrategyStatus({
      id,
      totalSignals: a.signals,
      resolvedSignals: a.resolved,
      winRate,
      averageR,
      profitFactor,
      maxDrawdownPct,
      riskProfile,
    });

    return {
      id,
      label: STRATEGY_LABELS[id],
      status,
      totalSignals: a.signals,
      resolvedSignals: a.resolved,
      winRate,
      averageR,
      profitFactor,
      falsePositives: a.falsePositives,
      falseNegatives: a.falseNegatives,
      correctSkips: a.correctSkips,
      maxDrawdownPct,
      bestRegime: best,
      worstRegime: worst,
      promotionReason: statusReason(status, a.signals, averageR, maxDrawdownPct),
    };
  });
}

function statusReason(
  status: StrategyPerformanceRow["status"],
  signals: number,
  avgR: number,
  maxDd: number,
): string {
  const t = VALIDATION_THRESHOLDS;
  if (status === "DISABLED") {
    if (maxDd >= t.maxDrawdownDisablePct) {
      return `Drawdown ${maxDd}% exceeds ${t.maxDrawdownDisablePct}% limit.`;
    }
    if (signals >= t.minSignalsForPaperOnly && avgR < t.avgRDisable) {
      return `Avg R ${avgR} with ${signals} signals — edge not proven.`;
    }
    return "Aggressive or risk lockout policy.";
  }
  if (status === "PAPER_ONLY") {
    return `Avg R ${avgR} over ${signals} signals — paper validation only.`;
  }
  if (status === "ACTIVE") {
    return `Win rate / avg R / profit factor meet promotion thresholds.`;
  }
  if (status === "WATCHLIST") {
    return `Sample size ${signals} < ${t.minSignalsForActive} — gather more data.`;
  }
  return "Experimental — limited history.";
}
