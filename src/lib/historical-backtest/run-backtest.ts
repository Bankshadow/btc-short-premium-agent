import { runDecisionEngineFromInput } from "@/lib/decision/analyze";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { GovernanceAnalyzePayload } from "@/lib/governance/governance-types";
import type { StrategyId } from "@/lib/validation/validation-types";
import { buildEngineInputFromBar } from "./build-engine-input";
import { computeBacktestMetrics, buildEquityCurve } from "./compute-metrics";
import { buildHistoricalMarketBar } from "./reconstruct-bar";
import type {
  BacktestRegimeSlice,
  BacktestResult,
  BacktestRuleImpactRow,
  BacktestScenario,
  BacktestTrade,
  RunBacktestInput,
} from "./types";
import { HISTORICAL_BACKTEST_SAFETY_NOTICE } from "./types";
import type { RegimeTaxonomy } from "@/lib/market-regime-brain/types";

function newRunId(): string {
  return `bt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function filterEntries(
  entries: DecisionLogEntry[],
  scenario: BacktestScenario,
): DecisionLogEntry[] {
  let list = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  if (scenario.dateFrom) {
    const from = new Date(scenario.dateFrom).getTime();
    list = list.filter((e) => new Date(e.timestamp).getTime() >= from);
  }
  if (scenario.dateTo) {
    const to = new Date(scenario.dateTo).getTime();
    list = list.filter((e) => new Date(e.timestamp).getTime() <= to);
  }

  if (scenario.maxSessions && scenario.maxSessions > 0) {
    list = list.slice(-scenario.maxSessions);
  }

  return list;
}

function resolveGovernance(
  scenario: BacktestScenario,
): GovernanceAnalyzePayload | null {
  const base = scenario.governance ?? {
    safeMode: false,
    disableAggressiveMode: false,
    pauseAnalysis: false,
    hardRules: {
      locked: false,
      activeRules: [],
      forcedVerdict: "SKIP" as const,
      messages: [],
    },
  };

  if (!scenario.proposedRuleTightening) return base;

  return {
    ...base,
    safeMode: true,
    hardRules: {
      locked: true,
      activeRules: [
        ...(base.hardRules?.activeRules ?? []),
        "missing_required_risk_data",
      ],
      forcedVerdict: "SKIP" as const,
      messages: [
        ...(base.hardRules?.messages ?? []),
        "Proposed rule tightening simulation",
      ],
    },
  };
}

function resolvePnl(
  entry: DecisionLogEntry,
  simulatedTrade: boolean,
): number | null {
  if (!simulatedTrade) return null;
  if (entry.paperPnl != null && entry.outcomeStatus === "RESOLVED") {
    return entry.paperPnl;
  }
  if (entry.missedOpportunityR != null && entry.missedOpportunityR > 0) {
    return entry.missedOpportunityR;
  }
  return simulatedTrade ? 0 : null;
}

function buildRuleImpact(trades: BacktestTrade[]): BacktestRuleImpactRow[] {
  const counts = new Map<string, { triggers: number; trades: number; pnl: number }>();

  for (const trade of trades) {
    for (const rule of trade.ruleTriggers) {
      const row = counts.get(rule) ?? { triggers: 0, trades: 0, pnl: 0 };
      row.triggers += 1;
      if (trade.simulatedVerdict === "TRADE") row.trades += 1;
      row.pnl += trade.pnlPct ?? 0;
      counts.set(rule, row);
    }
  }

  return [...counts.entries()].map(([ruleId, row]) => ({
    ruleId,
    label: ruleId.replace(/_/g, " "),
    triggerCount: row.triggers,
    tradesAffected: row.trades,
    estimatedPnlDeltaPct: Number(row.pnl.toFixed(2)),
  }));
}

function buildRegimeBreakdown(trades: BacktestTrade[]): BacktestRegimeSlice[] {
  const byRegime = new Map<
    RegimeTaxonomy,
    { sessions: number; trades: number; wins: number; net: number }
  >();

  for (const trade of trades) {
    const row = byRegime.get(trade.primaryRegime) ?? {
      sessions: 0,
      trades: 0,
      wins: 0,
      net: 0,
    };
    row.sessions += 1;
    if (trade.simulatedVerdict === "TRADE") {
      row.trades += 1;
      if ((trade.pnlPct ?? 0) > 0) row.wins += 1;
      row.net += trade.pnlPct ?? 0;
    }
    byRegime.set(trade.primaryRegime, row);
  }

  return [...byRegime.entries()].map(([regime, row]) => ({
    regime,
    label: regime.replace(/_/g, " "),
    sessions: row.sessions,
    simulatedTrades: row.trades,
    winRate:
      row.trades > 0 ? Math.round((row.wins / row.trades) * 100) : 0,
    netPnlPct: Number(row.net.toFixed(2)),
  }));
}

export function runHistoricalBacktest(input: RunBacktestInput): BacktestResult {
  const startedAt = new Date().toISOString();
  const runId = newRunId();
  const entries = filterEntries(input.entries, input.scenario);
  const governance = resolveGovernance(input.scenario);
  const adaptiveWeighting = input.scenario.enableAdaptiveWeighting
    ? input.scenario.adaptiveWeighting ?? null
    : null;

  const trades: BacktestTrade[] = [];
  let prevPrice: number | null = null;
  let consecutiveLosses = 0;

  for (const entry of entries) {
    const bar = buildHistoricalMarketBar(entry, prevPrice);
    prevPrice = entry.btcPrice;

    const engineInput = buildEngineInputFromBar({
      entry,
      bar,
      riskProfile: input.scenario.riskProfile,
      consecutiveLosses,
    });

    const response = runDecisionEngineFromInput(
      engineInput,
      undefined,
      undefined,
      null,
      input.scenario.strategyRegistry ?? null,
      governance,
      adaptiveWeighting,
    );

    const desk = response.tradingDesk;
    const simulatedVerdict =
      desk?.weightedCommittee?.weightedVerdict ??
      desk?.committee.finalVerdict ??
      "WAIT";
    const simulatedRiskVeto = desk?.committee.riskVeto ?? false;
    const playbookVerdict = response.step5_verdict.recommendation;
    const regimeBrain = desk?.regimeBrain;
    const simulatedTrade = simulatedVerdict === "TRADE" && !simulatedRiskVeto;
    const pnlPct = resolvePnl(entry, simulatedTrade);

    if (
      simulatedTrade &&
      entry.outcomeStatus === "RESOLVED" &&
      (pnlPct ?? 0) < 0
    ) {
      consecutiveLosses += 1;
    } else if (simulatedTrade && (pnlPct ?? 0) > 0) {
      consecutiveLosses = 0;
    }

    const ruleTriggers: string[] = [];
    for (const rule of response.step3_noTradeRules) {
      if (rule.triggered) ruleTriggers.push(rule.id);
    }
    if (simulatedRiskVeto) ruleTriggers.push("risk_veto");

    const falseTrade =
      simulatedTrade &&
      entry.outcomeStatus === "RESOLVED" &&
      (pnlPct ?? 0) < 0;
    const falseSkip =
      !simulatedTrade &&
      entry.finalVerdict === "TRADE" &&
      entry.outcomeStatus === "RESOLVED" &&
      (entry.paperPnl ?? 0) > 0;
    const missedOpportunity =
      !simulatedTrade &&
      (entry.falseSkipFlag === true ||
        (entry.missedOpportunityR != null && entry.missedOpportunityR > 0));

    trades.push({
      logId: entry.id,
      timestamp: entry.timestamp,
      btcPrice: entry.btcPrice,
      marketRegime: entry.marketRegime,
      loggedVerdict: entry.finalVerdict,
      simulatedVerdict,
      simulatedRiskVeto,
      playbookVerdict,
      aligned: simulatedVerdict === entry.finalVerdict,
      pnlPct,
      primaryRegime: regimeBrain?.primaryRegime ?? "SIDEWAYS",
      strategiesRecommended: (regimeBrain?.recommendedStrategies ??
        []) as StrategyId[],
      strategiesBlocked: (regimeBrain?.blockedStrategies ?? []) as StrategyId[],
      ruleTriggers,
      falseTrade,
      falseSkip,
      missedOpportunity,
      riskVetoBlocked: simulatedRiskVeto && entry.finalVerdict === "TRADE",
    });
  }

  const metrics = computeBacktestMetrics(trades, entries.length);
  const completedAt = new Date().toISOString();

  return {
    run: {
      id: runId,
      scenarioId: input.scenario.id,
      scenarioLabel: input.scenario.label,
      versionTag: input.scenario.versionTag,
      startedAt,
      completedAt,
      simulationOnly: true,
      cannotEnableLive: true,
      cannotAutoApprove: true,
    },
    metrics,
    trades,
    equityCurve: buildEquityCurve(trades),
    ruleImpact: buildRuleImpact(trades),
    regimeBreakdown: buildRegimeBreakdown(trades),
    safetyNotice: HISTORICAL_BACKTEST_SAFETY_NOTICE,
  };
}
