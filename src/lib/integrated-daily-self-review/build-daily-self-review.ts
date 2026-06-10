import type { AnomalyIncident } from "@/lib/anomaly-detection/types";

import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";

import type { IntegratedConfidenceCalibrationSnapshot } from "@/lib/integrated-confidence-calibration/types";

import type { IntegratedRiskBudgetSnapshot } from "@/lib/integrated-risk-budget/types";

import type { IntegratedStrategyHealthSnapshot } from "@/lib/integrated-strategy-health/types";

import type { EvidenceProgressSnapshot } from "@/lib/evidence-progress/types";

import type { ExecutionQualitySummary } from "@/lib/execution-quality/types";

import type { LearningProgressSnapshot } from "@/lib/learning-queue/types";

import type { IntegratedTradeQualitySnapshot } from "@/lib/trade-quality-score/types";

import {

  filterEntriesForUtcDay,

  utcDateKey,

} from "@/lib/daily-self-review/build-daily-self-review";

import type {

  TestnetClosedTrade,

  TestnetLearningRecord,

  TestnetMonitorJournalEvent,

} from "@/lib/testnet-monitor/types";

import type { DailySelfReview } from "./types";



const GOAL_START = 1000;

const GOAL_TARGET = 10000;



function round(n: number, digits = 2): number {

  const f = 10 ** digits;

  return Math.round(n * f) / f;

}



function filterTradesForUtcDay(

  trades: TestnetClosedTrade[],

  dateKey: string,

): TestnetClosedTrade[] {

  return trades.filter((t) => utcDateKey(t.closedAt) === dateKey);

}



function filterLearningForUtcDay(
  records: TestnetLearningRecord[],
  tradesToday: TestnetClosedTrade[],
  dateKey: string,
): TestnetLearningRecord[] {
  const tradeIds = new Set(tradesToday.map((t) => t.id));
  return records.filter(
    (r) =>
      tradeIds.has(r.tradeId) ||
      tradeIds.has(r.closedTradeId) ||
      utcDateKey(r.updatedAt) === dateKey,
  );
}



function filterEventsForUtcDay(

  events: TestnetMonitorJournalEvent[],

  dateKey: string,

): TestnetMonitorJournalEvent[] {

  return events.filter((e) => utcDateKey(e.timestamp) === dateKey);

}



function formatUsd(n: number): string {

  const sign = n < 0 ? "-" : "";

  return `${sign}$${Math.abs(n).toFixed(2)}`;

}



function buildMissionProgress(evidence: EvidenceProgressSnapshot): string {

  const equity = GOAL_START + evidence.realizedPnl;

  const progressPct = round(((equity - GOAL_START) / (GOAL_TARGET - GOAL_START)) * 100, 1);

  if (evidence.evidenceSetReady) {

    return `${progressPct}% toward $${GOAL_TARGET.toLocaleString()} · evidence set complete (${evidence.completedTrades} trades)`;

  }

  return `${progressPct}% toward $${GOAL_TARGET.toLocaleString()} · evidence ${evidence.completedTrades}/${evidence.requiredTrades} valid trades`;

}



function pickBestDecision(input: {

  entriesToday: DecisionLogEntry[];

  tradesToday: TestnetClosedTrade[];

  learningToday: TestnetLearningRecord[];

}): string {

  const winTrade = input.tradesToday.find((t) => t.result === "WIN");

  if (winTrade) {

    const lr = input.learningToday.find((r) => r.tradeId === winTrade.id || r.closedTradeId === winTrade.id);

    const reason = lr?.whatWorked ?? winTrade.notes ?? `${winTrade.symbol} ${winTrade.side}`;

    return `Win on ${winTrade.symbol}: ${reason.slice(0, 120)}`;

  }

  const tradeEntry = input.entriesToday.find((e) => e.finalVerdict === "TRADE" && !e.riskVeto);

  if (tradeEntry) {

    return `Held TRADE conviction at $${tradeEntry.btcPrice.toLocaleString()} — ${(tradeEntry.topReasons[0] ?? tradeEntry.actionPlan).slice(0, 100)}`;

  }

  const skipEntry = input.entriesToday.find((e) => e.finalVerdict === "SKIP" || e.finalVerdict === "WAIT");

  if (skipEntry) {

    return `Disciplined ${skipEntry.finalVerdict} when setup quality was insufficient.`;

  }

  return "Maintained testnet discipline — no forced entries today.";

}



function pickWorstDecision(input: {

  entriesToday: DecisionLogEntry[];

  tradesToday: TestnetClosedTrade[];

  learningToday: TestnetLearningRecord[];

}): string {

  const lossTrade = input.tradesToday

    .filter((t) => t.result === "LOSS")

    .sort((a, b) => a.netPnl - b.netPnl)[0];

  if (lossTrade) {

    const lr = input.learningToday.find((r) => r.tradeId === lossTrade.id || r.closedTradeId === lossTrade.id);

    const reason = lr?.whatFailed ?? lr?.closeReason ?? lossTrade.notes ?? "loss";

    return `Loss on ${lossTrade.symbol} ${lossTrade.side}: ${reason.slice(0, 120)}`;

  }

  const vetoIgnored = input.entriesToday.find((e) => e.finalVerdict === "TRADE" && e.riskVeto);

  if (vetoIgnored) {

    return `TRADE attempted despite risk veto at $${vetoIgnored.btcPrice.toLocaleString()}.`;

  }

  const overAnalyze =

    input.entriesToday.length > 20

      ? `${input.entriesToday.length} analyze cycles — possible over-scanning without edge.`

      : null;

  if (overAnalyze) return overAnalyze;

  return "No clearly bad decision today — continue current process.";

}



function buildRiskBehavior(input: {

  riskBudget: IntegratedRiskBudgetSnapshot;

  strategyHealth: IntegratedStrategyHealthSnapshot;

  incidents: AnomalyIncident[];

  riskEventsToday: TestnetMonitorJournalEvent[];

}): string {

  const parts: string[] = [];

  const mode = input.riskBudget.recommendation.mode;

  parts.push(`Risk budget mode ${mode} · max notional $${input.riskBudget.recommendation.recommendedMaxNotional}.`);

  const primary = input.strategyHealth.primaryReport;

  if (primary) {

    parts.push(`Strategy health ${primary.status}: ${primary.recommendation.slice(0, 100)}`);

  }

  const openIncidents = input.incidents.filter(

    (i) => i.status === "OPEN" || i.status === "INVESTIGATING",

  );

  if (openIncidents.length > 0) {

    parts.push(`${openIncidents.length} open governance incident(s) — ${openIncidents[0].title}.`);

  }

  const riskEvents = input.riskEventsToday.filter((e) =>

    ["RISK_BUDGET_RECOMMENDED", "STRATEGY_HEALTH_REVIEWED", "ERROR"].includes(e.eventType),

  );

  if (riskEvents.length > 0) {

    parts.push(`${riskEvents.length} risk-related journal event(s) today.`);

  }

  return parts.join(" ");

}



function buildExecutionIssues(eq: ExecutionQualitySummary): string[] {

  const issues: string[] = [];

  if (eq.liveQualityGate.status !== "PASS") {

    issues.push(...eq.liveQualityGate.reasons.slice(0, 2));

  }

  if (eq.rejectionRatePct > 5) {

    issues.push(`Rejection rate ${eq.rejectionRatePct}% — review order sizing and gates.`);

  }

  if (eq.failedOrderCount > 0) {

    issues.push(`${eq.failedOrderCount} failed order(s) on testnet.`);

  }

  if (eq.duplicateSubmissionCount > 0) {

    issues.push(`${eq.duplicateSubmissionCount} duplicate submission(s) detected.`);

  }

  if (eq.closeFailureCount > 0) {

    issues.push(`${eq.closeFailureCount} close failure(s) — check reduce-only path.`);

  }

  if (issues.length === 0) {

    issues.push("Execution quality within normal testnet parameters.");

  }

  return issues;

}



function buildLessonsLearned(input: {

  learningToday: TestnetLearningRecord[];

  learningProgress: LearningProgressSnapshot;

  tradeQuality: IntegratedTradeQualitySnapshot;

  calibration: IntegratedConfidenceCalibrationSnapshot;

  tradesToday: TestnetClosedTrade[];

}): string[] {

  const lessons: string[] = [];

  for (const lr of input.learningToday.slice(0, 3)) {

    if (lr.whatFailed) {

      lessons.push(`${lr.symbol}: ${lr.whatFailed.slice(0, 100)}`);

    } else if (lr.whatWorked) {

      lessons.push(`${lr.symbol} win: ${lr.whatWorked.slice(0, 100)}`);

    } else if (lr.suggestedAdjustment) {

      lessons.push(`${lr.symbol}: ${lr.suggestedAdjustment.slice(0, 100)}`);

    }

  }

  for (const mistake of input.learningProgress.recurringMistakes.slice(0, 2)) {

    lessons.push(mistake.message);

  }

  const avgQ = input.tradeQuality.summary.avgCompositeScore;

  if (avgQ > 0 && avgQ < 60) {

    lessons.push(

      `Avg trade quality ${avgQ}/100 — focus on ${input.tradeQuality.summary.weakestDimension ?? "entry timing"}.`,

    );

  }

  if (input.calibration.report.overconfidenceDetected) {

    lessons.push(input.calibration.report.confidenceAdjustmentRecommendation);

  }

  const losses = input.tradesToday.filter((t) => t.result === "LOSS").length;

  if (losses >= 2) {

    lessons.push(`${losses} losses today — tighten entry filters before next session.`);

  }

  if (lessons.length === 0) {

    lessons.push("No closed trades today — prioritize evidence collection and journal discipline.");

  }

  return lessons.slice(0, 6);

}



function buildSuggestedStrategyAdjustment(

  strategyHealth: IntegratedStrategyHealthSnapshot,

  riskBudget: IntegratedRiskBudgetSnapshot,

): string {

  const primary = strategyHealth.primaryReport;

  if (primary?.status === "REDUCE_RISK" || primary?.status === "PAUSE") {

    return primary.recommendation;

  }

  if (riskBudget.recommendation.mode === "DEFENSIVE" || riskBudget.recommendation.mode === "COOLDOWN") {

    return riskBudget.recommendation.reasons[0] ?? "Reduce testnet size until health improves.";

  }

  if (primary?.status === "CONTINUE") {

    return "Continue primary strategy — no adjustment suggested until evidence set completes.";

  }

  return primary?.recommendation ?? "Review strategy health report before changing advisory signals.";

}



function buildSuggestedCursorTask(input: {

  executionIssues: string[];

  lessonsLearned: string[];

  strategyHealth: IntegratedStrategyHealthSnapshot;

  pendingLearning: number;

}): string {

  const topLesson = input.lessonsLearned[0] ?? "Improve testnet learning loop.";

  const topIssue = input.executionIssues.find((i) => !i.includes("within normal")) ?? null;

  const healthStatus = input.strategyHealth.primaryReport?.status ?? "UNKNOWN";



  const focus =

    topIssue && input.pendingLearning > 0

      ? `Fix ${topIssue.slice(0, 80)} and clear ${input.pendingLearning} pending learning review(s).`

      : topIssue

        ? `Address execution issue: ${topIssue.slice(0, 100)}`

        : input.pendingLearning > 0

          ? `Add learning-queue UX to surface ${input.pendingLearning} pending review(s) on dashboard.`

          : healthStatus === "REDUCE_RISK" || healthStatus === "PAUSE"

            ? "Wire strategy-health REDUCE_RISK into operator checklist on /reports."

            : `Improve daily review automation: ${topLesson.slice(0, 100)}`;



  return [

    "You are working on btc-short-premium-agent.",

    "",

    "Implement an advisory improvement based on today's integrated daily AI self-review (MVP 79).",

    "",

    `Focus: ${focus}`,

    "",

    "Constraints:",

    "- Suggest only — no automatic strategy change.",

    "- No live trading.",

    "- Preserve governance and risk gates.",

    "- Human approval required for settings changes.",

    "",

    "Deliverables:",

    "- Focused code change with tests where relevant.",

    "- Short summary of what changed and why.",

  ].join("\n");

}



function buildTomorrowPlan(input: {

  lessonsLearned: string[];

  riskBudget: IntegratedRiskBudgetSnapshot;

  learningProgress: LearningProgressSnapshot;

  evidence: EvidenceProgressSnapshot;

}): string {

  const parts: string[] = [];

  parts.push(`Risk mode ${input.riskBudget.recommendation.mode} — cap $${input.riskBudget.recommendation.recommendedMaxNotional} notional.`);

  if (input.learningProgress.pendingCount > 0) {

    parts.push(`Review ${input.learningProgress.pendingCount} pending learning record(s) on /learning.`);

  }

  if (!input.evidence.evidenceSetReady) {

    parts.push(`Collect evidence: ${input.evidence.remainingTrades} valid trade(s) remaining.`);

  }

  parts.push(input.lessonsLearned[0] ?? "Maintain testnet discipline and double-confirm executes.");

  return parts.join(" ");

}



export function buildIntegratedDailySelfReview(input: {

  dateKey?: string;

  evidenceProgress: EvidenceProgressSnapshot;

  closedTrades: TestnetClosedTrade[];

  decisions: DecisionLogEntry[];

  learningRecords: TestnetLearningRecord[];

  learningProgress: LearningProgressSnapshot;

  strategyHealth: IntegratedStrategyHealthSnapshot;

  tradeQuality: IntegratedTradeQualitySnapshot;

  confidenceCalibration: IntegratedConfidenceCalibrationSnapshot;

  riskBudget: IntegratedRiskBudgetSnapshot;

  executionQuality: ExecutionQualitySummary;

  monitorEvents: TestnetMonitorJournalEvent[];

  incidents: AnomalyIncident[];

  dailyPnlUsd: number;

}): DailySelfReview {

  const dateKey = input.dateKey ?? utcDateKey();

  const entriesToday = filterEntriesForUtcDay(input.decisions, dateKey);

  const tradesToday = filterTradesForUtcDay(input.closedTrades, dateKey);

  const learningToday = filterLearningForUtcDay(input.learningRecords, tradesToday, dateKey);

  const eventsToday = filterEventsForUtcDay(input.monitorEvents, dateKey);



  const winsToday = tradesToday.filter((t) => t.result === "WIN").length;

  const lossesToday = tradesToday.filter((t) => t.result === "LOSS").length;

  const pnlToday = round(

    tradesToday.reduce((sum, t) => sum + t.netPnl, 0) || input.dailyPnlUsd,

  );



  const bestDecision = pickBestDecision({ entriesToday, tradesToday, learningToday });

  const worstDecision = pickWorstDecision({ entriesToday, tradesToday, learningToday });

  const executionIssues = buildExecutionIssues(input.executionQuality);

  const lessonsLearned = buildLessonsLearned({

    learningToday,

    learningProgress: input.learningProgress,

    tradeQuality: input.tradeQuality,

    calibration: input.confidenceCalibration,

    tradesToday,

  });



  const biggestMistake =

    lossesToday > 0

      ? worstDecision

      : executionIssues.some((i) => !i.includes("within normal"))

        ? executionIssues[0]

        : entriesToday.length > 20

          ? `High analyze frequency (${entriesToday.length} cycles) without proportional edge.`

          : "No major mistake flagged — maintain discipline.";



  const riskBehavior = buildRiskBehavior({

    riskBudget: input.riskBudget,

    strategyHealth: input.strategyHealth,

    incidents: input.incidents,

    riskEventsToday: eventsToday,

  });



  const suggestedStrategyAdjustment = buildSuggestedStrategyAdjustment(

    input.strategyHealth,

    input.riskBudget,

  );

  const tomorrowPlan = buildTomorrowPlan({

    lessonsLearned,

    riskBudget: input.riskBudget,

    learningProgress: input.learningProgress,

    evidence: input.evidenceProgress,

  });

  const suggestedCursorTask = buildSuggestedCursorTask({

    executionIssues,

    lessonsLearned,

    strategyHealth: input.strategyHealth,

    pendingLearning: input.learningProgress.pendingCount,

  });



  const linkedLearningRecordIds = learningToday

    .map((r) => r.learningRecordId)

    .filter(Boolean)

    .slice(0, 10);



  const oneLineSummary = [

    `${winsToday}W/${lossesToday}L today`,

    formatUsd(pnlToday),

    biggestMistake.slice(0, 60),

  ].join(" · ");



  return {

    reviewId: `idsr-${dateKey}-${Date.now()}`,

    date: dateKey,

    generatedAt: new Date().toISOString(),

    missionProgress: buildMissionProgress(input.evidenceProgress),

    tradesToday: tradesToday.length,

    pnlToday,

    bestDecision,

    worstDecision,

    biggestMistake,

    riskBehavior,

    executionIssues,

    lessonsLearned,

    tomorrowPlan,

    suggestedStrategyAdjustment,

    suggestedCursorTask,

    oneLineSummary,

    linkedLearningRecordIds,

    requiresApproval: true,

    advisoryOnly: true,

    liveTradingLocked: true,

  };

}



export { utcDateKey, filterTradesForUtcDay };


