import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { TradeEvaluationResult } from "@/lib/self-learning/types";
import {
  DIMENSION_LABELS,
  TRADE_QUALITY_GRADE_THRESHOLDS,
  TRADE_QUALITY_WEIGHTS,
} from "./config";
import { TRADE_QUALITY_SAFETY_NOTICE } from "./types";
import type {
  TradeQualityDimensions,
  TradeQualityGrade,
  TradeQualityScore,
} from "./types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function gradeFromComposite(score: number): TradeQualityGrade {
  for (const row of TRADE_QUALITY_GRADE_THRESHOLDS) {
    if (score >= row.min) return row.grade;
  }
  return "F";
}

function scoreSetup(entry: DecisionLogEntry): number {
  let score = 45;
  if (entry.preMortem && entry.preMortem.preMortemVerdict !== "BLOCK") score += 18;
  if (entry.learningSnapshot) score += 8;
  if (entry.marketRegime && entry.marketRegime !== "Unknown") score += 12;
  if ((entry.playbookConfidence ?? 0) >= 60) score += 12;
  if (entry.agentOutputs.some((a) => a.agentName === "Data Quality Agent" && a.missingData.length === 0)) {
    score += 10;
  }
  if (entry.topReasons.length >= 2) score += 8;
  return clamp(score);
}

function scoreEntry(
  entry: DecisionLogEntry,
  tradeWouldWin: boolean | null,
  pnlPct: number,
): number {
  let score = 50;
  if (entry.finalVerdict === "TRADE" && tradeWouldWin === true) score += 28;
  else if (entry.finalVerdict === "TRADE" && tradeWouldWin === false) score -= 22;
  else if (entry.finalVerdict !== "TRADE" && tradeWouldWin === false) score += 18;
  else if (entry.finalVerdict !== "TRADE" && tradeWouldWin === true) score -= 12;

  if (entry.falseTradeFlag) score -= 25;
  if (entry.falseSkipFlag) score -= 15;
  if (!entry.operatorOverride) score += 8;
  if ((entry.playbookConfidence ?? 50) >= 55) score += 10;
  if (pnlPct > 0 && entry.finalVerdict === "TRADE") score += 8;
  return clamp(score);
}

function scoreRiskReward(entry: DecisionLogEntry, pnlPct: number): number {
  let score = 52;
  if ((entry.avoidedLossR ?? 0) > 0) score += 18;
  if ((entry.missedOpportunityR ?? 0) <= 1) score += 8;
  else if ((entry.missedOpportunityR ?? 0) > 3) score -= 12;
  if (
    entry.orderTicket?.takeProfit != null &&
    entry.orderTicket.entryPrice > 0 &&
    entry.orderTicket.stopLoss > 0
  ) {
    const risk = Math.abs(entry.orderTicket.entryPrice - entry.orderTicket.stopLoss);
    const reward = Math.abs(entry.orderTicket.takeProfit - entry.orderTicket.entryPrice);
    if (risk > 0 && reward / risk >= 1.5) score += 15;
  }
  if (entry.orderTicket && entry.orderTicket.positionSizePct <= 5) score += 10;
  if (pnlPct < -3) score -= 15;
  if (pnlPct > 0 && pnlPct < 8) score += 6;
  return clamp(score);
}

function scoreExecution(entry: DecisionLogEntry): number {
  let score = 55;
  if (entry.analyzeStatus === "SUCCESS") score += 15;
  if (entry.orderTicket) score += 25;
  if (entry.tradeControl?.lastExecutionMode) score += 12;
  return clamp(score);
}

function scoreExit(entry: DecisionLogEntry, tradeWouldWin: boolean | null): number {
  let score = 48;
  if (entry.resolution) score += 22;
  const label = entry.resolution?.outcomeLabel;
  if (label === "WIN" || label === "LOSS" || label === "BREAKEVEN") score += 18;
  if (label === "INVALIDATED" || label === "EXPIRED") score -= 20;
  if (entry.reflection) score += 15;
  if (entry.autopsy && tradeWouldWin === false) score += 8;
  return clamp(score);
}

function scoreRuleCompliance(entry: DecisionLogEntry, tradeWouldWin: boolean | null): number {
  let score = 58;
  if (entry.riskVeto && tradeWouldWin === false) score += 20;
  if (entry.riskVeto && tradeWouldWin === true) score -= 18;
  if (!entry.operatorOverride?.disagreeWithVerdict) score += 12;
  if (entry.deskRiskProfile) score += 8;
  if (entry.preMortem?.preMortemVerdict === "BLOCK" && entry.finalVerdict === "TRADE") {
    score -= 30;
  }
  return clamp(score);
}

function scoreAiReasoning(evaluation?: TradeEvaluationResult | null): number {
  if (!evaluation) return 55;
  const committee = evaluation.committeeEvaluation.reasoning.reasoningQuality;
  const agentAvg =
    evaluation.agentEvaluations.length > 0
      ? evaluation.agentEvaluations.reduce(
          (sum, a) => sum + a.reasoning.reasoningQuality,
          0,
        ) / evaluation.agentEvaluations.length
      : 55;
  const regretPenalty = Math.min(25, evaluation.committeeEvaluation.reasoning.regretScore / 4);
  return clamp(committee * 0.55 + agentAvg * 0.45 - regretPenalty);
}

function compositeScore(dimensions: TradeQualityDimensions): number {
  let total = 0;
  for (const key of Object.keys(TRADE_QUALITY_WEIGHTS) as (keyof TradeQualityDimensions)[]) {
    total += dimensions[key] * TRADE_QUALITY_WEIGHTS[key];
  }
  return clamp(total);
}

function buildImprovements(dimensions: TradeQualityDimensions): string[] {
  const ranked = (Object.keys(dimensions) as (keyof TradeQualityDimensions)[])
    .map((key) => ({ key, value: dimensions[key] }))
    .sort((a, b) => a.value - b.value);

  const hints: string[] = [];
  for (const dim of ranked.slice(0, 3)) {
    if (dim.value >= 70) continue;
    switch (dim.key) {
      case "setupQuality":
        hints.push("Improve setup: run pre-mortem and confirm regime + data quality before TRADE.");
        break;
      case "entryQuality":
        hints.push("Tighten entry: align committee TRADE with higher conviction and fewer false positives.");
        break;
      case "riskReward":
        hints.push("Improve risk/reward: target ≥1.5R setups and cap position size in defensive modes.");
        break;
      case "executionQuality":
        hints.push("Review execution path — check testnet journal for rejections, latency, or duplicates.");
        break;
      case "exitQuality":
        hints.push("Document exit rationale with reflection or autopsy on losing closes.");
        break;
      case "ruleCompliance":
        hints.push("Respect risk veto and pre-mortem blocks — do not override gates for speed.");
        break;
      case "aiReasoningQuality":
        hints.push("Strengthen agent reasoning — address missed risk factors in committee debate.");
        break;
    }
  }
  return [...new Set(hints)].slice(0, 3);
}

function primaryReason(
  grade: TradeQualityGrade,
  dimensions: TradeQualityDimensions,
  pnlPct: number,
): string {
  const weakest = (Object.keys(dimensions) as (keyof TradeQualityDimensions)[])
    .map((key) => ({ key, value: dimensions[key] }))
    .sort((a, b) => a.value - b.value)[0];

  if (grade === "A") {
    return `Strong process across dimensions${pnlPct > 0 ? " with positive outcome" : " despite flat/negative PnL"}.`;
  }
  if (weakest) {
    return `Grade ${grade} — weakest: ${DIMENSION_LABELS[weakest.key]} (${weakest.value}/100).`;
  }
  return `Grade ${grade} based on composite decision quality.`;
}

export function buildTradeQualityScore(input: {
  entry: DecisionLogEntry;
  evaluation?: TradeEvaluationResult | null;
  source?: string;
  pnlPct?: number;
  tradeWouldWin?: boolean | null;
}): TradeQualityScore {
  const entry = input.entry;
  const pnlPct = input.pnlPct ?? entry.paperPnl ?? 0;
  const tradeWouldWin =
    input.tradeWouldWin ??
    entry.resolution?.tradeWouldWin ??
    (pnlPct > 0 ? true : pnlPct < 0 ? false : null);

  const dimensions: TradeQualityDimensions = {
    setupQuality: scoreSetup(entry),
    entryQuality: scoreEntry(entry, tradeWouldWin, pnlPct),
    riskReward: scoreRiskReward(entry, pnlPct),
    executionQuality: scoreExecution(entry),
    exitQuality: scoreExit(entry, tradeWouldWin),
    ruleCompliance: scoreRuleCompliance(entry, tradeWouldWin),
    aiReasoningQuality: scoreAiReasoning(input.evaluation),
  };

  const composite = compositeScore(dimensions);
  const grade = gradeFromComposite(composite);

  return {
    scoreId: `tqs-${entry.id}-${Date.now()}`,
    decisionLogId: entry.id,
    generatedAt: new Date().toISOString(),
    source: input.source ?? "resolved_trade",
    grade,
    compositeScore: composite,
    dimensions,
    primaryReason: primaryReason(grade, dimensions, pnlPct),
    improvements: buildImprovements(dimensions),
    pnlPct,
    tradeWouldWin,
    safetyNotice: TRADE_QUALITY_SAFETY_NOTICE,
    advisoryOnly: true,
  };
}

export function gradeToNumeric(grade: TradeQualityGrade): number {
  return { A: 95, B: 78, C: 62, D: 45, F: 25 }[grade];
}
