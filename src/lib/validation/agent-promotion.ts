import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { buildAgentScoreboard } from "@/lib/journal/agent-scoreboard";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import { VALIDATION_THRESHOLDS } from "./validation-config";
import { classifyFuturesDirection } from "./classify-strategy";
import type {
  AgentValidationRow,
  StrategyId,
  StrategyPerformanceRow,
  StrategyStatus,
} from "./validation-types";

const AGENT_TO_STRATEGY: Record<string, StrategyId | "desk"> = {
  "Options Strategy Agent": "options_short_premium",
  "Spot Strategy Agent": "spot",
  "Futures Strategy Agent": "futures_long",
  "Market Data Agent": "eth_btc",
  "Regime Agent": "desk",
  "Data Quality Agent": "desk",
  "Macro & News Agent": "desk",
  "Desk Memory Agent": "desk",
  "Bull Thesis Agent": "desk",
  "Bear Thesis Agent": "desk",
  "Risk Manager Agent": "desk",
};

export function resolveStrategyStatus(input: {
  id: StrategyId;
  totalSignals: number;
  resolvedSignals: number;
  winRate: number;
  averageR: number;
  profitFactor: number;
  maxDrawdownPct: number;
  riskProfile: DeskRiskProfile;
}): StrategyStatus {
  const t = VALIDATION_THRESHOLDS;
  const { id, totalSignals, resolvedSignals, winRate, averageR, profitFactor, maxDrawdownPct } =
    input;

  if (id === "aggressive_risk_mode" && averageR <= t.aggressiveMaxLossPct) {
    return "DISABLED";
  }
  if (maxDrawdownPct >= t.maxDrawdownDisablePct) return "DISABLED";
  if (totalSignals < t.minSignalsWatchlist) return "WATCHLIST";

  if (
    totalSignals >= t.minSignalsForPaperOnly &&
    averageR < t.avgRDisable &&
    resolvedSignals >= 8
  ) {
    return "PAPER_ONLY";
  }

  if (
    totalSignals >= t.minSignalsForActive &&
    averageR >= t.avgRActive &&
    winRate >= t.winRateActive &&
    profitFactor >= t.profitFactorActive &&
    maxDrawdownPct < t.maxDrawdownWatchPct
  ) {
    return "ACTIVE";
  }

  if (maxDrawdownPct >= t.maxDrawdownWatchPct) return "PAPER_ONLY";

  if (totalSignals >= t.minSignalsWatchlist) return "WATCHLIST";
  return "EXPERIMENTAL";
}

export function buildAgentValidationBoard(
  entries: DecisionLogEntry[],
  strategyMatrix: StrategyPerformanceRow[],
): AgentValidationRow[] {
  const scoreboard = buildAgentScoreboard(entries);
  const strategyStatus = new Map(strategyMatrix.map((s) => [s.id, s.status]));

  return scoreboard.agents.map((row) => {
    let strategyId: StrategyId | "desk" =
      AGENT_TO_STRATEGY[row.agentName] ?? "desk";

    if (row.agentName === "Futures Strategy Agent") {
      const last = entries.find((e) =>
        e.agentOutputs.some((a) => a.agentName === row.agentName),
      );
      const agent = last?.agentOutputs.find(
        (a) => a.agentName === "Futures Strategy Agent",
      );
      if (agent) {
        const dir = classifyFuturesDirection(agent);
        if (dir) strategyId = dir;
      }
    }

    const resolved = entries.filter((e) => e.outcomeStatus === "RESOLVED");
    const agentEntries = resolved.filter((e) =>
      e.agentOutputs.some((a) => a.agentName === row.agentName),
    );
    const pnls = agentEntries
      .filter((e) => e.paperPnl != null)
      .map((e) => e.paperPnl!);
    const averageR =
      pnls.length > 0
        ? Number((pnls.reduce((s, x) => s + x, 0) / pnls.length).toFixed(2))
        : 0;
    const winRate =
      row.totalCalls > 0
        ? Math.round(
            ((row.correctTradeCalls + row.correctSkips) / row.totalCalls) * 100,
          )
        : 0;

    let maxDrawdownPct = 0;
    let peak = 0;
    let equity = 0;
    for (const p of pnls) {
      equity += p;
      if (equity > peak) peak = equity;
      maxDrawdownPct = Math.max(maxDrawdownPct, peak - equity);
    }

    let status: StrategyStatus = "WATCHLIST";
    if (strategyId !== "desk") {
      status = strategyStatus.get(strategyId) ?? "WATCHLIST";
    } else if (row.agentName === "Risk Manager Agent" && winRate >= 60) {
      status = "ACTIVE";
    } else if (row.totalCalls < VALIDATION_THRESHOLDS.minSignalsWatchlist) {
      status = "EXPERIMENTAL";
    } else if (averageR < 0 && row.totalCalls >= 15) {
      status = "PAPER_ONLY";
    } else if (winRate >= 55 && averageR >= 0.2) {
      status = "ACTIVE";
    }

    return {
      agentName: row.agentName,
      strategyId,
      status,
      totalCalls: row.totalCalls,
      winRate,
      averageR,
      maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
      promotionReason: `${status} — ${row.totalCalls} calls, ${winRate}% accuracy, avg R ${averageR}`,
    };
  });
}
