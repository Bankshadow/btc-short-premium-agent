import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { strategiesSignaledOnEntry } from "@/lib/validation/classify-strategy";
import type { StrategyId } from "@/lib/validation/validation-types";
import type { RegimeEvaluation, TradeEvaluationResult } from "./types";

export function buildRegimeEvaluations(
  entries: DecisionLogEntry[],
  results: TradeEvaluationResult[],
): RegimeEvaluation[] {
  const resolved = entries.filter((e) => e.outcomeStatus === "RESOLVED");
  const byRegime = new Map<
    string,
    {
      wins: number;
      n: number;
      pnl: number;
      agents: Map<string, { hits: number; n: number }>;
      strategies: Map<StrategyId, number>;
    }
  >();

  for (const entry of resolved) {
    const regime = entry.marketRegime;
    const stat = byRegime.get(regime) ?? {
      wins: 0,
      n: 0,
      pnl: 0,
      agents: new Map(),
      strategies: new Map(),
    };
    const pnl = entry.paperPnl ?? 0;
    const win = entry.resolution?.tradeWouldWin === true || pnl > 0;
    stat.n += 1;
    stat.pnl += pnl;
    if (win) stat.wins += 1;

    for (const agent of entry.agentOutputs) {
      const aStat = stat.agents.get(agent.agentName) ?? { hits: 0, n: 0 };
      aStat.n += 1;
      const aligned =
        (agent.recommendation === "TRADE" && win) ||
        ((agent.recommendation === "SKIP" || agent.recommendation === "WAIT") &&
          !win);
      if (aligned) aStat.hits += 1;
      stat.agents.set(agent.agentName, aStat);
    }

    for (const sid of strategiesSignaledOnEntry(entry)) {
      stat.strategies.set(sid, (stat.strategies.get(sid) ?? 0) + 1);
    }

    byRegime.set(regime, stat);
  }

  const resultAgents = new Map<string, Map<string, number>>();
  for (const result of results) {
    const regimeMap = resultAgents.get(result.marketRegime) ?? new Map();
    for (const ev of result.agentEvaluations) {
      regimeMap.set(
        ev.agentName,
        (regimeMap.get(ev.agentName) ?? 0) + ev.helpingScore,
      );
    }
    resultAgents.set(result.marketRegime, regimeMap);
  }

  return [...byRegime.entries()]
    .map(([regime, stat]) => {
      const agentRows = [...stat.agents.entries()].map(([name, a]) => ({
        name,
        hitRate: a.n > 0 ? Math.round((a.hits / a.n) * 100) : 0,
      }));
      const sortedAgents = agentRows.sort((a, b) => b.hitRate - a.hitRate);
      const dominant = [...stat.strategies.entries()].sort(
        (a, b) => b[1] - a[1],
      )[0];

      return {
        regime,
        hitRate: stat.n > 0 ? Math.round((stat.wins / stat.n) * 100) : 0,
        avgPnlPct: stat.n > 0 ? Number((stat.pnl / stat.n).toFixed(2)) : 0,
        sampleSize: stat.n,
        bestAgent: sortedAgents[0]?.name ?? null,
        worstAgent: sortedAgents[sortedAgents.length - 1]?.name ?? null,
        dominantStrategy: dominant?.[0] ?? null,
      } satisfies RegimeEvaluation;
    })
    .sort((a, b) => b.sampleSize - a.sampleSize);
}
