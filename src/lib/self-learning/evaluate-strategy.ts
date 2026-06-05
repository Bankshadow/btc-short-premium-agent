import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { strategiesSignaledOnEntry } from "@/lib/validation/classify-strategy";
import { STRATEGY_LABELS } from "@/lib/validation/validation-config";
import type { StrategyId } from "@/lib/validation/validation-types";
import type { StrategyEvaluation, TradeEvaluationResult } from "./types";

export function buildStrategyEvaluations(
  entries: DecisionLogEntry[],
  results: TradeEvaluationResult[],
): StrategyEvaluation[] {
  const resolved = entries.filter((e) => e.outcomeStatus === "RESOLVED");
  const byStrategy = new Map<
    StrategyId,
    {
      wins: number;
      losses: number;
      pnl: number;
      n: number;
      fp: number;
      fn: number;
      regimes: Map<string, { wins: number; n: number; pnl: number }>;
    }
  >();

  for (const entry of resolved) {
    const strategies = strategiesSignaledOnEntry(entry);
    const pnl = entry.paperPnl ?? 0;
    const win = entry.resolution?.tradeWouldWin === true || pnl > 0;

    for (const sid of strategies) {
      const stat = byStrategy.get(sid) ?? {
        wins: 0,
        losses: 0,
        pnl: 0,
        n: 0,
        fp: 0,
        fn: 0,
        regimes: new Map(),
      };
      stat.n += 1;
      stat.pnl += pnl;
      if (win) stat.wins += 1;
      else stat.losses += 1;

      if (entry.finalVerdict === "TRADE" && !win) stat.fp += 1;
      if (entry.finalVerdict === "SKIP" && win) stat.fn += 1;

      const regimeStat = stat.regimes.get(entry.marketRegime) ?? {
        wins: 0,
        n: 0,
        pnl: 0,
      };
      regimeStat.n += 1;
      regimeStat.pnl += pnl;
      if (win) regimeStat.wins += 1;
      stat.regimes.set(entry.marketRegime, regimeStat);
      byStrategy.set(sid, stat);
    }
  }

  const agentByStrategy = new Map<StrategyId, string>();
  for (const result of results) {
    for (const sid of result.strategies) {
      const best = result.agentEvaluations
        .filter((a) => a.prediction.hitRate === 100)
        .sort((a, b) => b.helpingScore - a.helpingScore)[0];
      if (best && !agentByStrategy.has(sid)) {
        agentByStrategy.set(sid, best.agentName);
      }
    }
  }

  return [...byStrategy.entries()]
    .map(([strategyId, stat]) => {
      const regimeRows = [...stat.regimes.entries()].map(([regime, r]) => ({
        regime,
        hitRate: r.n > 0 ? Math.round((r.wins / r.n) * 100) : 0,
        avgPnl: r.n > 0 ? r.pnl / r.n : 0,
      }));
      const sorted = regimeRows.sort((a, b) => b.avgPnl - a.avgPnl);
      return {
        strategyId,
        label: STRATEGY_LABELS[strategyId] ?? strategyId,
        hitRate: stat.n > 0 ? Math.round((stat.wins / stat.n) * 100) : 0,
        avgPnlPct: stat.n > 0 ? Number((stat.pnl / stat.n).toFixed(2)) : 0,
        sampleSize: stat.n,
        falsePositiveRate:
          stat.n > 0 ? Math.round((stat.fp / stat.n) * 100) : 0,
        falseNegativeRate:
          stat.n > 0 ? Math.round((stat.fn / stat.n) * 100) : 0,
        bestRegime: sorted[0]?.regime ?? null,
        worstRegime: sorted[sorted.length - 1]?.regime ?? null,
        agentAlignment: agentByStrategy.get(strategyId) ?? "Insufficient agent linkage",
      } satisfies StrategyEvaluation;
    })
    .sort((a, b) => b.sampleSize - a.sampleSize);
}
