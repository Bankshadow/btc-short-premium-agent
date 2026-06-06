import type { AgentRecommendation } from "@/lib/agents/types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type {
  AiTradeComparison,
  ShadowStrategyMetrics,
  ShadowTradeResult,
  StrategyShadowTrade,
} from "./types";
import {
  AI_COMMITTEE_SOURCE_ID,
  AI_COMMITTEE_STRATEGY_NAME,
  SHADOW_PROMOTION_RULES,
} from "./types";

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function tradeResult(pnl: number | null, closed: boolean): ShadowTradeResult {
  if (!closed) return "OPEN";
  if (pnl === null) return "BREAKEVEN";
  if (pnl > 0.0001) return "WIN";
  if (pnl < -0.0001) return "LOSS";
  return "BREAKEVEN";
}

function maxDrawdownFromPnls(pnls: number[]): number {
  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  for (const p of pnls) {
    equity += p;
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? ((peak - equity) / Math.max(peak, 1)) * 100 : 0;
    if (dd > maxDd) maxDd = dd;
  }
  return round(maxDd);
}

export function computeStrategyMetrics(
  trades: StrategyShadowTrade[],
  sourceId: string,
): ShadowStrategyMetrics | null {
  const subset = trades.filter((t) => t.sourceId === sourceId);
  if (subset.length === 0) return null;
  const closed = subset.filter((t) => t.result !== "OPEN");
  const pnls = closed
    .map((t) => t.virtualPnL)
    .filter((p): p is number => p !== null);
  const wins = pnls.filter((p) => p > 0).length;
  const winRate = pnls.length > 0 ? Math.round((wins / pnls.length) * 100) : 0;
  const shadowPnL = round(pnls.reduce((s, p) => s + p, 0));
  const sample = subset[0];

  return {
    sourceId,
    strategyName: sample.strategyName,
    sourceType: sample.sourceType,
    sampleSize: subset.length,
    closedTrades: closed.length,
    openTrades: subset.length - closed.length,
    winRate,
    shadowPnL,
    maxDrawdownPct: maxDrawdownFromPnls(pnls),
    falsePositives: subset.filter((t) => t.falsePositive).length,
    falseNegatives: subset.filter((t) => t.falseNegative).length,
    avgVirtualPnL: pnls.length > 0 ? round(shadowPnL / pnls.length) : 0,
  };
}

export function tagCommitteeAlignment(
  trades: StrategyShadowTrade[],
  entries: DecisionLogEntry[],
): StrategyShadowTrade[] {
  const byTime = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return trades.map((trade) => {
    if (trade.side === "FLAT") return trade;
    const tradeTs = new Date(trade.createdAt).getTime();
    let nearest: DecisionLogEntry | null = null;
    let minDelta = Infinity;
    for (const entry of byTime) {
      const delta = Math.abs(new Date(entry.timestamp).getTime() - tradeTs);
      if (delta < minDelta) {
        minDelta = delta;
        nearest = entry;
      }
    }
    if (!nearest || minDelta > 4 * 3_600_000) return trade;

    const committeeVerdict = nearest.finalVerdict;
    const quantWouldTrade = trade.side === "LONG" || trade.side === "SHORT";
    const committeeWouldTrade = committeeVerdict === "TRADE";
    const aligned = quantWouldTrade === committeeWouldTrade;
    const falsePositive = quantWouldTrade && !committeeWouldTrade;
    const falseNegative = !quantWouldTrade && committeeWouldTrade;

    return {
      ...trade,
      decisionLogId: nearest.id,
      committeeVerdict,
      alignedWithCommittee: aligned,
      falsePositive,
      falseNegative,
    };
  });
}

export function buildAiTradeComparison(input: {
  shadowTrades: StrategyShadowTrade[];
  aiTrades: PaperOrder[];
  quantMetrics: ShadowStrategyMetrics[];
}): AiTradeComparison | null {
  const quantClosed = input.shadowTrades.filter(
    (t) => t.sourceType === "quant_import" && t.result !== "OPEN",
  );
  if (quantClosed.length === 0 && input.aiTrades.length === 0) return null;

  const quantPnls = quantClosed
    .map((t) => t.virtualPnL)
    .filter((p): p is number => p !== null);
  const quantWins = quantPnls.filter((p) => p > 0).length;
  const shadowWinRate =
    quantPnls.length > 0 ? round((quantWins / quantPnls.length) * 100) : 0;
  const shadowPnL = round(quantPnls.reduce((s, p) => s + p, 0));

  const aiClosed = input.aiTrades.filter(
    (o) => o.status === "CLOSED" && o.paperMode !== "RELAXED_PAPER",
  );
  const aiPnls = aiClosed.map((o) => o.realizedPnlPct ?? 0);
  const aiWins = aiPnls.filter((p) => p > 0).length;
  const aiWinRate = aiPnls.length > 0 ? round((aiWins / aiPnls.length) * 100) : 0;
  const aiPnL = round(aiPnls.reduce((s, p) => s + p, 0));

  const falsePositives = quantClosed.filter((t) => t.falsePositive).length;
  const falseNegatives = quantClosed.filter((t) => t.falseNegative).length;

  const winRateDelta = round(shadowWinRate - aiWinRate);
  const pnlDelta = round(shadowPnL - aiPnL);

  let summary: string;
  if (quantPnls.length === 0) {
    summary = "No quant shadow samples yet — run shadow replay.";
  } else if (aiPnls.length === 0) {
    summary = `Quant shadow: ${shadowWinRate}% win, ${shadowPnL}% net (n=${quantPnls.length}). No strict AI paper trades to compare.`;
  } else if (pnlDelta > 0 && winRateDelta >= 0) {
    summary = `Quant shadow ahead of AI paper by ${pnlDelta}% PnL and ${winRateDelta}% win rate.`;
  } else if (pnlDelta < 0) {
    summary = `AI committee paper ahead by ${Math.abs(pnlDelta)}% PnL — quant shadow needs review.`;
  } else {
    summary = `Mixed — shadow win ${shadowWinRate}% vs AI ${aiWinRate}%, PnL delta ${pnlDelta}%.`;
  }

  return {
    aiSampleSize: aiPnls.length,
    aiWinRate,
    aiPnL,
    shadowWinRate,
    shadowPnL,
    winRateDelta,
    pnlDelta,
    falsePositives,
    falseNegatives,
    summary,
  };
}

export function evaluatePromotionEligibility(
  metrics: ShadowStrategyMetrics,
): { eligible: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (metrics.closedTrades < SHADOW_PROMOTION_RULES.minSampleSize) {
    blockers.push(
      `Need ${SHADOW_PROMOTION_RULES.minSampleSize}+ closed shadow trades (have ${metrics.closedTrades}).`,
    );
  }
  if (metrics.maxDrawdownPct > SHADOW_PROMOTION_RULES.maxDrawdownPct) {
    blockers.push(
      `Max drawdown ${metrics.maxDrawdownPct}% exceeds ${SHADOW_PROMOTION_RULES.maxDrawdownPct}% threshold.`,
    );
  }
  if (metrics.winRate < SHADOW_PROMOTION_RULES.minWinRate) {
    blockers.push(
      `Win rate ${metrics.winRate}% below ${SHADOW_PROMOTION_RULES.minWinRate}% minimum.`,
    );
  }
  return { eligible: blockers.length === 0, blockers };
}

export function mapQuantTradeToShadow(input: {
  sourceId: string;
  strategyName: string;
  symbol: string;
  importStatus: string;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice: number;
  netPnlPct: number;
  entryTime: string;
  exitTime: string;
}): StrategyShadowTrade {
  const closed = true;
  return {
    id: `shadow-${input.sourceId}-${input.entryTime}`,
    sourceType: "quant_import",
    strategyName: input.strategyName,
    sourceId: input.sourceId,
    symbol: input.symbol,
    side: input.direction,
    entryPrice: input.entryPrice,
    virtualExit: input.exitPrice,
    virtualPnL: input.netPnlPct,
    result: tradeResult(input.netPnlPct, closed),
    createdAt: input.entryTime,
    closedAt: input.exitTime,
    importStatus: input.importStatus as StrategyShadowTrade["importStatus"],
    advisoryOnly: true,
    executionBlocked: true,
    cannotCountAsLiveProof: true,
  };
}

export function mapCommitteeEntryToShadow(
  entry: DecisionLogEntry,
): StrategyShadowTrade | null {
  if (entry.finalVerdict !== "TRADE" || entry.isDemoData) return null;
  const pnl =
    entry.paperPnl ??
    entry.resolution?.manualPnlPct ??
    (entry.resolution?.tradeWouldWin === true
      ? 1.5
      : entry.resolution?.tradeWouldWin === false
        ? -1.5
        : null);
  const closed = entry.outcomeStatus === "RESOLVED" || pnl !== null;
  const side: "LONG" | "SHORT" =
    entry.actionPlan?.toLowerCase().includes("long") ||
    entry.topReasons?.some((r) => r.toLowerCase().includes("long"))
      ? "LONG"
      : "SHORT";

  return {
    id: `shadow-ai-${entry.id}`,
    sourceType: "ai_committee",
    strategyName: AI_COMMITTEE_STRATEGY_NAME,
    sourceId: AI_COMMITTEE_SOURCE_ID,
    symbol: "BTCUSDT",
    side,
    entryPrice: entry.btcPrice,
    virtualExit: closed ? entry.btcPrice : null,
    virtualPnL: pnl,
    result: tradeResult(pnl, closed),
    createdAt: entry.timestamp,
    closedAt: entry.resolution?.resolvedAt ?? (closed ? entry.timestamp : null),
    decisionLogId: entry.id,
    committeeVerdict: entry.finalVerdict as AgentRecommendation,
    alignedWithCommittee: true,
    advisoryOnly: true,
    executionBlocked: true,
    cannotCountAsLiveProof: true,
  };
}
