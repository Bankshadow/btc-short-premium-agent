import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { TradeQualityScore } from "@/lib/trade-quality-score/types";
import type { EvidenceProgressRow } from "@/lib/evidence-progress/types";
import type { TestnetLearningRecord } from "@/lib/testnet-monitor/types";
import type { StrategyHealthReport, StrategyHealthStatus } from "./types";
import { STRATEGY_HEALTH_EVIDENCE_REQUIRED } from "./types";

function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function reportIdForTag(tag: string): string {
  return `ish-${tag}-${Date.now()}`;
}

function computeMaxDrawdown(pnls: number[]): number {
  let peak = 0;
  let equity = 0;
  let maxDd = 0;
  for (const pnl of pnls) {
    equity += pnl;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDd) maxDd = dd;
  }
  return round(maxDd, 4);
}

function resolveStatus(input: {
  evidenceCount: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  netPnl: number;
  riskVetoRate: number;
  avgQuality: number | null;
  strategyOverconfident?: boolean;
}): StrategyHealthStatus {
  if (input.evidenceCount < STRATEGY_HEALTH_EVIDENCE_REQUIRED) {
    return "NEEDS_MORE_DATA";
  }
  if (
    input.winRate < 40 ||
    input.profitFactor < 0.75 ||
    (input.netPnl < 0 && input.winRate < 45)
  ) {
    return "REJECT";
  }
  if (
    input.winRate < 45 ||
    input.profitFactor < 0.95 ||
    input.riskVetoRate > 0.35
  ) {
    return "PAUSE";
  }
  if (
    input.winRate < 52 ||
    input.profitFactor < 1.1 ||
    input.maxDrawdown > Math.max(20, Math.abs(input.netPnl) * 0.5) ||
    (input.avgQuality != null && input.avgQuality < 55) ||
    input.strategyOverconfident
  ) {
    return "REDUCE_RISK";
  }
  return "CONTINUE";
}

function recommendationForStatus(
  status: StrategyHealthStatus,
  strategyTag: string,
): { recommendation: string; nextAction: string } {
  switch (status) {
    case "NEEDS_MORE_DATA":
      return {
        recommendation: `Collect ${STRATEGY_HEALTH_EVIDENCE_REQUIRED} valid closed testnet trades before strategy health verdict.`,
        nextAction: `Complete ${STRATEGY_HEALTH_EVIDENCE_REQUIRED - 0} more valid testnet closes with decisionLogId and PnL.`,
      };
    case "REJECT":
      return {
        recommendation: `${strategyTag} failed testnet evidence — pause new entries and review thesis.`,
        nextAction: "Review learning queue and strategy registry before any testnet entries.",
      };
    case "PAUSE":
      return {
        recommendation: `${strategyTag} underperforming on testnet — pause new entries pending review.`,
        nextAction: "Operator review required — do not increase risk or enable live.",
      };
    case "REDUCE_RISK":
      return {
        recommendation: `${strategyTag} marginal on testnet — continue with reduced size only.`,
        nextAction: "Keep testnet size conservative; review recurring mistakes in learning queue.",
      };
    case "CONTINUE":
      return {
        recommendation: `${strategyTag} passed 12-trade testnet evidence — continue testnet validation.`,
        nextAction: "Continue testnet cycles; strategy registry change still requires operator approval.",
      };
  }
}

function inferWeakness(input: {
  losses: EvidenceProgressRow[];
  riskVetoRate: number;
  avgQuality: number | null;
  closeReasons: string[];
  confidenceCalibrationGap?: number | null;
  confidenceOverconfident?: boolean;
}): string | null {
  if (input.confidenceOverconfident && input.confidenceCalibrationGap != null) {
    return `AI overconfidence — stated confidence exceeds win rate by ${round(input.confidenceCalibrationGap)}%.`;
  }
  if (input.riskVetoRate > 0.25) {
    return `Risk veto on ${round(input.riskVetoRate * 100)}% of linked decisions.`;
  }
  if (input.avgQuality != null && input.avgQuality < 60) {
    return `Low average trade quality score (${round(input.avgQuality)}).`;
  }
  const stopLosses = input.closeReasons.filter((r) => /stop loss/i.test(r)).length;
  if (stopLosses >= 2) {
    return `Repeated stop-loss exits (${stopLosses}×).`;
  }
  if (input.losses.length >= 3) {
    return `${input.losses.length} losses in evidence set — review entry timing.`;
  }
  return input.losses[0]?.closeReason ?? null;
}

function inferBestPattern(wins: EvidenceProgressRow[]): string | null {
  if (wins.length === 0) return null;
  const byReason = new Map<string, number>();
  for (const w of wins) {
    const key = w.closeReason ?? w.strategy ?? "win";
    byReason.set(key, (byReason.get(key) ?? 0) + 1);
  }
  const top = [...byReason.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top) return null;
  return `${top[1]}× wins aligned with: ${top[0]}`;
}

export function buildStrategyHealthReportForTag(input: {
  strategyTag: string;
  trades: EvidenceProgressRow[];
  decisions: DecisionLogEntry[];
  learningRecords: TestnetLearningRecord[];
  qualityByDecision: Map<string, TradeQualityScore>;
  strategyCalibration?: import("@/lib/integrated-confidence-calibration/types").AffectedStrategyCalibration | null;
}): StrategyHealthReport {
  const wins = input.trades.filter((t) => t.result === "WIN");
  const losses = input.trades.filter((t) => t.result === "LOSS");
  const evidenceCount = input.trades.length;
  const winRate =
    evidenceCount > 0 ? round((wins.length / evidenceCount) * 100) : 0;
  const grossWin = wins.reduce((s, t) => s + t.netPnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.netPnl, 0));
  const profitFactor =
    grossLoss > 0 ? round(grossWin / grossLoss) : grossWin > 0 ? 99 : 0;
  const orderedPnls = [...input.trades]
    .sort((a, b) => a.closedAt.localeCompare(b.closedAt))
    .map((t) => t.netPnl);
  const maxDrawdown = computeMaxDrawdown(orderedPnls);
  const avgWin =
    wins.length > 0 ? round(grossWin / wins.length) : 0;
  const avgLoss =
    losses.length > 0 ? round(grossLoss / losses.length) : 0;
  const netPnl = round(input.trades.reduce((s, t) => s + t.netPnl, 0));

  const decisionIds = [
    ...new Set(
      input.trades.map((t) => t.decisionLogId).filter(Boolean) as string[],
    ),
  ];
  const linkedDecisions = input.decisions.filter((d) =>
    decisionIds.includes(d.id),
  );
  const vetoCount = linkedDecisions.filter((d) => d.riskVeto).length;
  const riskVetoRate =
    linkedDecisions.length > 0 ? vetoCount / linkedDecisions.length : 0;
  let tradeVotes = 0;
  let tradeAgreement = 0;
  for (const d of linkedDecisions) {
    const agents = d.agentOutputs ?? [];
    if (agents.length === 0) continue;
    tradeVotes += 1;
    const agree = agents.filter((a) => a.recommendation === "TRADE").length;
    if (agree / agents.length >= 0.5) tradeAgreement += 1;
  }
  const agentTradeAgreementRate =
    tradeVotes > 0 ? round(tradeAgreement / tradeVotes, 3) : 0;

  const qualityScores = decisionIds
    .map((id) => input.qualityByDecision.get(id))
    .filter((s): s is TradeQualityScore => Boolean(s));
  const avgTradeQualityScore =
    qualityScores.length > 0
      ? round(
          qualityScores.reduce((s, q) => s + q.compositeScore, 0) /
            qualityScores.length,
        )
      : null;

  const closeReasons = input.trades
    .map((t) => t.closeReason)
    .filter((r): r is string => Boolean(r));

  const status = resolveStatus({
    evidenceCount,
    winRate,
    profitFactor,
    maxDrawdown,
    netPnl,
    riskVetoRate,
    avgQuality: avgTradeQualityScore,
    strategyOverconfident: input.strategyCalibration?.overconfident ?? false,
  });

  const { recommendation, nextAction: baseNext } = recommendationForStatus(
    status,
    input.strategyTag,
  );
  const nextAction =
    status === "NEEDS_MORE_DATA"
      ? `Complete ${Math.max(0, STRATEGY_HEALTH_EVIDENCE_REQUIRED - evidenceCount)} more valid testnet closes.`
      : baseNext;

  const tradeIds = input.trades.map((t) => t.tradeId);
  const linkedLearningRecordIds = input.learningRecords
    .filter((r) => tradeIds.includes(r.tradeId ?? r.closedTradeId))
    .map((r) => r.learningRecordId);

  return {
    reportId: reportIdForTag(input.strategyTag),
    strategyTag: input.strategyTag,
    status,
    evidenceCount,
    winRate,
    profitFactor,
    maxDrawdown,
    avgWin,
    avgLoss,
    biggestWeakness: inferWeakness({
      losses,
      riskVetoRate,
      avgQuality: avgTradeQualityScore,
      closeReasons,
      confidenceCalibrationGap: input.strategyCalibration?.calibrationGap ?? null,
      confidenceOverconfident: input.strategyCalibration?.overconfident ?? false,
    }),
    bestPattern: inferBestPattern(wins),
    recommendation,
    nextAction,
    linkedDecisionIds: decisionIds,
    linkedTradeIds: tradeIds,
    linkedLearningRecordIds,
    avgTradeQualityScore,
    riskVetoRate: round(riskVetoRate, 3),
    agentTradeAgreementRate,
    confidenceCalibrationGap: input.strategyCalibration?.calibrationGap ?? null,
    confidenceOverconfident: input.strategyCalibration?.overconfident ?? false,
    netPnl,
    reviewedAt: new Date().toISOString(),
  };
}

export function groupEvidenceTradesByStrategyTag(
  trades: EvidenceProgressRow[],
): Map<string, EvidenceProgressRow[]> {
  const byTag = new Map<string, EvidenceProgressRow[]>();
  for (const trade of trades) {
    const tag = trade.strategy ?? "ai_signal";
    const list = byTag.get(tag) ?? [];
    list.push(trade);
    byTag.set(tag, list);
  }
  return byTag;
}

export function selectPrimaryStrategyReport(
  reports: StrategyHealthReport[],
): StrategyHealthReport | null {
  if (reports.length === 0) return null;
  return [...reports].sort((a, b) => b.evidenceCount - a.evidenceCount)[0] ?? null;
}

export function blocksTestnetEntriesForHealth(
  report: StrategyHealthReport | null,
): boolean {
  if (!report) return false;
  return report.status === "PAUSE" || report.status === "REJECT";
}
