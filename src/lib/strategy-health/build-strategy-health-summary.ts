import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { TestnetMonitorSnapshot } from "@/lib/testnet-monitor/types";
import type { ExecutionQualityStrategyRow } from "@/lib/execution-quality/types";
import { STRATEGY_LABELS } from "@/lib/validation/validation-config";
import { primaryStrategyForPaper, strategiesSignaledOnEntry } from "@/lib/validation/classify-strategy";
import type { StrategyId } from "@/lib/validation/validation-types";
import type {
  StrategyAgentAgreementQuality,
  StrategyEnvironmentHealthMetrics,
  StrategyHealthEnvironment,
  StrategyHealthInput,
  StrategyHealthRecommendation,
  StrategyHealthRow,
  StrategyHealthSignal,
  StrategyHealthStatus,
  StrategyHealthSummary,
} from "./types";

type NumericPoint = { pnl: number; durationMs: number | null; regime: string };

interface StrategyAccumulator {
  paper: NumericPoint[];
  shadow: NumericPoint[];
  testnet: NumericPoint[];
  live: NumericPoint[];
  falseTradeCount: number;
  falseSkipCount: number;
  agreementTotal: number;
  agreementHits: number;
  regimeNet: Map<string, number>;
}

function emptyAcc(): StrategyAccumulator {
  return {
    paper: [],
    shadow: [],
    testnet: [],
    live: [],
    falseTradeCount: 0,
    falseSkipCount: 0,
    agreementTotal: 0,
    agreementHits: 0,
    regimeNet: new Map<string, number>(),
  };
}

function durationMs(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return null;
  return e - s;
}

function maxDrawdown(series: number[]): number {
  if (!series.length) return 0;
  let equity = 0;
  let peak = 0;
  let worst = 0;
  for (const v of series) {
    equity += v;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > worst) worst = dd;
  }
  return Number(worst.toFixed(2));
}

function normalizedEnvMetrics(
  environment: StrategyHealthEnvironment,
  rows: NumericPoint[],
): StrategyEnvironmentHealthMetrics {
  const sampleSize = rows.length;
  const wins = rows.filter((r) => r.pnl > 0).length;
  const winRate = sampleSize > 0 ? Number(((wins / sampleSize) * 100).toFixed(1)) : 0;
  const totalPnlRaw = rows.reduce((s, r) => s + r.pnl, 0);
  const totalPnl = Number(totalPnlRaw.toFixed(2));
  const averageR = sampleSize > 0 ? Number((totalPnlRaw / sampleSize).toFixed(2)) : 0;
  const durations = rows.map((r) => r.durationMs).filter((v): v is number => v != null);
  const averageDurationMs =
    durations.length > 0
      ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
      : 0;
  const maxDd = maxDrawdown(rows.map((r) => r.pnl));
  return {
    environment,
    sampleSize,
    winRate,
    averageR,
    totalPnl,
    maxDrawdown: maxDd,
    averageDurationMs,
  };
}

function bestWorstRegime(map: Map<string, number>): { bestRegime: string; worstRegime: string } {
  if (!map.size) return { bestRegime: "—", worstRegime: "—" };
  let best = "—";
  let worst = "—";
  let bestVal = -Infinity;
  let worstVal = Infinity;
  for (const [regime, net] of map) {
    if (net > bestVal) {
      bestVal = net;
      best = regime;
    }
    if (net < worstVal) {
      worstVal = net;
      worst = regime;
    }
  }
  return { bestRegime: best, worstRegime: worst };
}

function buildAgreementQuality(acc: StrategyAccumulator): StrategyAgentAgreementQuality {
  if (acc.agreementTotal <= 0) {
    return { scorePct: 0, label: "UNKNOWN", comparedEntries: 0 };
  }
  const pct = Number(((acc.agreementHits / acc.agreementTotal) * 100).toFixed(1));
  const label: StrategyAgentAgreementQuality["label"] =
    pct >= 75 ? "HIGH" : pct >= 50 ? "MEDIUM" : "LOW";
  return {
    scorePct: pct,
    label,
    comparedEntries: acc.agreementTotal,
  };
}

function deriveStatus(row: {
  sampleSize: number;
  testnetSamples: number;
  liveSamples: number;
  avgR: number;
  maxDrawdown: number;
  winRate: number;
}): StrategyHealthStatus {
  if (row.maxDrawdown >= 10 || row.avgR < -0.25) return "PAUSED";
  if (row.sampleSize < 5) return "WATCHLIST";
  if (row.avgR < 0 || row.winRate < 40) return "REVIEW_REQUIRED";
  if (row.liveSamples >= 5 && row.avgR > 0.3 && row.winRate >= 55) return "CANDIDATE_FOR_LIVE";
  if (row.testnetSamples >= 3) return "ACTIVE_TESTNET";
  return "ACTIVE_PAPER";
}

function deriveRecommendation(input: {
  status: StrategyHealthStatus;
  sampleSize: number;
  avgR: number;
  drawdown: number;
  winRate: number;
  testnetSamples: number;
}): StrategyHealthRecommendation {
  if (input.status === "PAUSED") return "pause strategy";
  if (input.status === "REVIEW_REQUIRED") return "run risk replay";
  if (input.status === "WATCHLIST" || input.sampleSize < 8) return "gather more samples";
  if (input.drawdown >= 6 || input.winRate < 50) return "reduce size";
  if (input.status === "ACTIVE_TESTNET" && input.avgR > 0.25 && input.testnetSamples >= 6) {
    return "promote to next stage";
  }
  return "continue";
}

function addRegimeNet(acc: StrategyAccumulator, regime: string, pnl: number): void {
  if (!regime) return;
  const prev = acc.regimeNet.get(regime) ?? 0;
  acc.regimeNet.set(regime, prev + pnl);
}

function addPaperData(accByStrategy: Map<StrategyId, StrategyAccumulator>, input: StrategyHealthInput): void {
  for (const entry of input.entries) {
    const strategyIds = strategiesSignaledOnEntry(entry);
    if (!strategyIds.length) continue;

    const votePool = entry.agentOutputs.filter((a) => a.recommendation === "TRADE");
    const agreementRatio =
      entry.agentOutputs.length > 0 ? votePool.length / entry.agentOutputs.length : 0;

    for (const sid of strategyIds) {
      const acc = accByStrategy.get(sid);
      if (!acc) continue;
      if (entry.falseTradeFlag) acc.falseTradeCount += 1;
      if (entry.falseSkipFlag) acc.falseSkipCount += 1;

      if (entry.finalVerdict === "TRADE") {
        acc.agreementTotal += 1;
        if (agreementRatio >= 0.5) acc.agreementHits += 1;
      }

      if (entry.outcomeStatus === "RESOLVED" && entry.paperPnl != null) {
        acc.paper.push({
          pnl: entry.paperPnl,
          durationMs: durationMs(entry.timestamp, entry.resolution?.resolvedAt ?? null),
          regime: entry.marketRegime ?? "unknown",
        });
        addRegimeNet(acc, entry.marketRegime ?? "unknown", entry.paperPnl);
      }
    }
  }

  for (const order of input.orders) {
    if (order.status !== "CLOSED" || order.realizedPnlPct == null) continue;
    const sid = primaryStrategyForPaper(order.instrument, order.side);
    const acc = accByStrategy.get(sid);
    if (!acc) continue;
    const point: NumericPoint = {
      pnl: order.realizedPnlPct,
      durationMs: durationMs(order.openedAt, order.closedAt),
      regime: "paper_order",
    };
    if (order.paperMode === "RELAXED_PAPER") acc.shadow.push(point);
    else acc.paper.push(point);
    addRegimeNet(acc, point.regime, point.pnl);
  }

  if (input.orders.length === 0) {
    for (const trade of input.unifiedPortfolio?.closedTrades ?? []) {
      const sid = inferStrategyIdFromName(trade.strategyName, trade.side);
      const acc = accByStrategy.get(sid);
      if (!acc) continue;
      const point: NumericPoint = {
        pnl: trade.realizedPnlPct ?? 0,
        durationMs: durationMs(trade.createdAt, trade.closedAt),
        regime: "paper_unified",
      };
      if (trade.paperMode === "RELAXED_PAPER") acc.shadow.push(point);
      else acc.paper.push(point);
      addRegimeNet(acc, point.regime, point.pnl);
    }
  }
}

function addTestnetData(
  accByStrategy: Map<StrategyId, StrategyAccumulator>,
  snapshot: TestnetMonitorSnapshot | null | undefined,
): void {
  if (!snapshot?.closedTrades?.length) return;
  for (const trade of snapshot.closedTrades) {
    const sid = inferStrategyIdFromName(
      trade.strategy ?? "testnet",
      trade.side === "SHORT" ? "short" : "long",
    );
    const acc = accByStrategy.get(sid);
    if (!acc) continue;
    const pnl = trade.netPnl ?? 0;
    const row: NumericPoint = {
      pnl,
      durationMs: durationMs(trade.openedAt, trade.closedAt),
      regime: trade.strategy ?? "testnet",
    };
    acc.testnet.push(row);
    addRegimeNet(acc, row.regime, pnl);
  }
}

function addLiveData(
  accByStrategy: Map<StrategyId, StrategyAccumulator>,
  liveTrades: LiveTradeJournalEntry[] | undefined,
): void {
  if (!liveTrades?.length) return;
  for (const trade of liveTrades) {
    if (trade.status !== "CLOSED") continue;
    const pnl = trade.realizedPnl ?? 0;
    const inferred =
      trade.symbol.toUpperCase().includes("ETH")
        ? ("eth_btc" as StrategyId)
        : trade.side.toLowerCase().includes("sell") || trade.side.toLowerCase().includes("short")
          ? ("futures_short" as StrategyId)
          : ("futures_long" as StrategyId);
    const acc = accByStrategy.get(inferred);
    if (!acc) continue;
    const row: NumericPoint = {
      pnl,
      durationMs: durationMs(trade.executedAt ?? trade.createdAt, trade.closedAt),
      regime: "live_journal",
    };
    acc.live.push(row);
    addRegimeNet(acc, row.regime, pnl);
  }
}

function summarizeRow(
  strategyId: StrategyId,
  acc: StrategyAccumulator,
  executionRow?: ExecutionQualityStrategyRow,
): StrategyHealthRow {
  const envMetrics: Record<StrategyHealthEnvironment, StrategyEnvironmentHealthMetrics> = {
    PAPER: normalizedEnvMetrics("PAPER", acc.paper),
    SHADOW: normalizedEnvMetrics("SHADOW", acc.shadow),
    TESTNET: normalizedEnvMetrics("TESTNET", acc.testnet),
    LIVE: normalizedEnvMetrics("LIVE", acc.live),
  };

  const allRows = [...acc.paper, ...acc.shadow, ...acc.testnet, ...acc.live];
  const aggregate = normalizedEnvMetrics("PAPER", allRows);
  const { bestRegime, worstRegime } = bestWorstRegime(acc.regimeNet);
  const agreement = buildAgreementQuality(acc);

  let status = deriveStatus({
    sampleSize: aggregate.sampleSize,
    testnetSamples: envMetrics.TESTNET.sampleSize,
    liveSamples: envMetrics.LIVE.sampleSize,
    avgR: aggregate.averageR,
    maxDrawdown: aggregate.maxDrawdown,
    winRate: aggregate.winRate,
  });

  const executionReliabilityPct = Number(
    (executionRow?.reliabilityPct ?? 100).toFixed(2),
  );
  const executionWarning =
    (executionRow?.rejectionRatePct ?? 0) >= 15 ||
    executionReliabilityPct < 70;
  if (status !== "PAUSED" && (executionRow?.rejectionRatePct ?? 0) >= 20) {
    status = "REVIEW_REQUIRED";
  }
  if (status !== "PAUSED" && executionReliabilityPct < 50) {
    status = "PAUSED";
  }

  let recommendation = deriveRecommendation({
    status,
    sampleSize: aggregate.sampleSize,
    avgR: aggregate.averageR,
    drawdown: aggregate.maxDrawdown,
    winRate: aggregate.winRate,
    testnetSamples: envMetrics.TESTNET.sampleSize,
  });
  if (executionWarning && status !== "PAUSED") {
    recommendation = "run risk replay";
  }

  return {
    strategyId,
    strategyLabel: STRATEGY_LABELS[strategyId],
    sampleSize: aggregate.sampleSize,
    winRate: aggregate.winRate,
    averageR: aggregate.averageR,
    totalPnl: aggregate.totalPnl,
    maxDrawdown: aggregate.maxDrawdown,
    averageDurationMs: aggregate.averageDurationMs,
    falseTradeCount: acc.falseTradeCount,
    falseSkipCount: acc.falseSkipCount,
    bestRegime,
    worstRegime,
    agentAgreementQuality: agreement,
    currentStatus: status,
    recommendation,
    executionReliabilityPct,
    executionWarning,
    environmentMetrics: envMetrics,
  };
}

function inferStrategyIdFromName(name: string, side: string): StrategyId {
  const lower = name.toLowerCase();
  const sideLower = side.toLowerCase();
  if (lower.includes("eth")) return "eth_btc";
  if (lower.includes("aggressive")) return "aggressive_risk_mode";
  if (lower.includes("spot")) return "spot";
  if (lower.includes("futures") || lower.includes("perp")) {
    if (sideLower.includes("short") || sideLower.includes("sell")) return "futures_short";
    return "futures_long";
  }
  return "options_short_premium";
}

export function buildStrategyHealthSummary(input: StrategyHealthInput): StrategyHealthSummary {
  const strategyIds = Object.keys(STRATEGY_LABELS) as StrategyId[];
  const accByStrategy = new Map<StrategyId, StrategyAccumulator>();
  for (const sid of strategyIds) accByStrategy.set(sid, emptyAcc());

  addPaperData(accByStrategy, input);
  addTestnetData(accByStrategy, input.testnetSnapshot);
  addLiveData(accByStrategy, input.liveTrades);

  const executionRows =
    input.executionQuality?.byStrategy ?? input.testnetSnapshot?.executionQuality?.byStrategy ?? [];
  const executionByStrategy = new Map<StrategyId, ExecutionQualityStrategyRow>();
  for (const row of executionRows) {
    executionByStrategy.set(row.strategyId, row);
  }

  const rows = strategyIds
    .map((sid) =>
      summarizeRow(sid, accByStrategy.get(sid)!, executionByStrategy.get(sid)),
    )
    .sort((a, b) => b.sampleSize - a.sampleSize);

  const totals = {
    strategies: rows.length,
    watchlist: rows.filter((r) => r.currentStatus === "WATCHLIST").length,
    activePaper: rows.filter((r) => r.currentStatus === "ACTIVE_PAPER").length,
    activeTestnet: rows.filter((r) => r.currentStatus === "ACTIVE_TESTNET").length,
    reviewRequired: rows.filter((r) => r.currentStatus === "REVIEW_REQUIRED").length,
    paused: rows.filter((r) => r.currentStatus === "PAUSED").length,
    candidateForLive: rows.filter((r) => r.currentStatus === "CANDIDATE_FOR_LIVE").length,
  };

  const envs: StrategyHealthEnvironment[] = ["PAPER", "SHADOW", "TESTNET", "LIVE"];
  const environmentTotals = envs.reduce(
    (acc, env) => {
      const sampleSize = rows.reduce((s, r) => s + r.environmentMetrics[env].sampleSize, 0);
      const totalPnl = Number(
        rows.reduce((s, r) => s + r.environmentMetrics[env].totalPnl, 0).toFixed(2),
      );
      acc[env] = {
        sampleSize,
        winRate: sampleSize
          ? Number(
              (
                rows.reduce(
                  (s, r) => s + r.environmentMetrics[env].winRate * r.environmentMetrics[env].sampleSize,
                  0,
                ) / sampleSize
              ).toFixed(1),
            )
          : 0,
        averageR: sampleSize
          ? Number(
              (
                rows.reduce(
                  (s, r) =>
                    s + r.environmentMetrics[env].averageR * r.environmentMetrics[env].sampleSize,
                  0,
                ) / sampleSize
              ).toFixed(2),
            )
          : 0,
        totalPnl,
      };
      return acc;
    },
    {} as StrategyHealthSummary["environmentTotals"],
  );

  return {
    generatedAt: new Date().toISOString(),
    rows,
    totals,
    environmentTotals,
  };
}

export function buildStrategyHealthSignal(
  summary: StrategyHealthSummary,
  tradeQuality?: { avgCompositeScore: number; avgGrade: string | null },
): StrategyHealthSignal {
  const healthyStrategies = summary.rows.filter(
    (r) =>
      r.currentStatus === "ACTIVE_PAPER" ||
      r.currentStatus === "ACTIVE_TESTNET" ||
      r.currentStatus === "CANDIDATE_FOR_LIVE",
  ).length;
  const total = summary.totals.strategies || 1;
  let score =
    (healthyStrategies * 100 - summary.totals.reviewRequired * 8 - summary.totals.paused * 15) /
    total;
  if (tradeQuality && tradeQuality.avgCompositeScore < 55) score -= 10;
  else if (tradeQuality && tradeQuality.avgCompositeScore >= 75) score += 4;

  return {
    generatedAt: summary.generatedAt,
    totalStrategies: summary.totals.strategies,
    healthyStrategies,
    reviewRequiredCount: summary.totals.reviewRequired,
    pausedCount: summary.totals.paused,
    candidateForLiveCount: summary.totals.candidateForLive,
    healthScorePct: Number(Math.max(0, Math.min(100, score)).toFixed(1)),
    tradeQualityAvgScore: tradeQuality?.avgCompositeScore ?? null,
    tradeQualityAvgGrade: tradeQuality?.avgGrade ?? null,
  };
}
