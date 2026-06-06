import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { GoalTradeRow } from "@/lib/goal-engine/build-trade-list";
import type { MissionControllerResult } from "@/lib/mission-controller/types";
import type { MissionFlowSnapshot } from "@/lib/mission-flow/types";
import type { ParallelReviewContext } from "@/lib/parallel-task-runner/build-review-context";
import { DAILY_SELF_REVIEW_SAFETY_NOTICE } from "./types";
import type { TradeQualitySummary } from "@/lib/trade-quality-score/types";
import type {
  DailyReviewQuestions,
  DailyReviewVerdict,
  DailySelfReviewRecord,
} from "./types";

export function utcDateKey(iso: string | Date = new Date()): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function filterEntriesForUtcDay(
  entries: DecisionLogEntry[],
  dateKey: string,
): DecisionLogEntry[] {
  return entries.filter((e) => {
    if (e.isDemoData) return false;
    return utcDateKey(e.timestamp) === dateKey;
  });
}

export function filterTradesForUtcDay(trades: GoalTradeRow[], dateKey: string): GoalTradeRow[] {
  return trades.filter((t) => t.date.startsWith(dateKey));
}

export function computeDailyScore(input: {
  mission: MissionControllerResult;
  analyzeCyclesToday: number;
  winsToday: number;
  lossesToday: number;
  dailyPnlPct: number;
  executionGate: string;
  riskBlocked: boolean;
  duplicateSubmissions: number;
  missedHoldSignals: number;
}): number {
  let score = 72;

  if (input.mission.mode === "NORMAL" || input.mission.mode === "OPPORTUNITY") {
    score += 8;
  } else if (input.mission.mode === "DEFENSIVE" || input.mission.mode === "RECOVERY") {
    score += 4;
  } else if (input.mission.mode === "PAUSED") {
    score += input.lossesToday === 0 ? 6 : 2;
  }

  if (input.executionGate === "PASS") score += 8;
  else if (input.executionGate === "WARNING") score += 3;
  else score -= 12;

  if (!input.riskBlocked && input.lossesToday === 0) score += 5;
  if (input.dailyPnlPct >= 0) score += 6;
  else score -= Math.min(18, Math.round(Math.abs(input.dailyPnlPct) * 2));

  score += Math.min(10, input.winsToday * 4);
  score -= Math.min(24, input.lossesToday * 8);

  if (input.duplicateSubmissions > 0) score -= 15;
  if (input.mission.mode === "PAUSED" && input.analyzeCyclesToday > 8) score -= 8;

  const overtrade =
    (input.mission.mode === "DEFENSIVE" || input.mission.mode === "RECOVERY") &&
    input.analyzeCyclesToday > 12 &&
    input.winsToday + input.lossesToday >= 2;
  if (overtrade) score -= 12;

  if (input.missedHoldSignals >= 3) score -= 6;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function answer(
  verdict: DailyReviewVerdict,
  detail: string,
): { verdict: DailyReviewVerdict; detail: string } {
  return { verdict, detail };
}

export function buildDailyReviewQuestions(input: {
  mission: MissionControllerResult;
  snapshot: MissionFlowSnapshot;
  analyzeCyclesToday: number;
  tradesToday: GoalTradeRow[];
  winsToday: number;
  lossesToday: number;
  ctx: ParallelReviewContext;
  missedHoldSignals: number;
  tradeQuality?: TradeQualitySummary | null;
}): DailyReviewQuestions {
  const { mission, snapshot, analyzeCyclesToday, tradesToday, winsToday, lossesToday, ctx } =
    input;
  const eq = ctx.executionQuality;
  const risk = ctx.riskReport;
  const loopActive = ctx.loopGuard?.blocker.active === true;

  const tradedWhilePaused =
    mission.mode === "PAUSED" && tradesToday.some((t) => t.result !== "OPEN");
  const followedMission: DailyReviewVerdict = tradedWhilePaused
    ? "no"
    : mission.mode === "PAUSED" && tradesToday.length === 0
      ? "yes"
      : mission.humanApprovalNeeded && snapshot.pendingTestnetPreview
        ? "partial"
        : "yes";

  const closedToday = winsToday + lossesToday;
  const overtraded: DailyReviewVerdict =
    (mission.mode === "DEFENSIVE" || mission.mode === "RECOVERY") &&
    analyzeCyclesToday > 12 &&
    closedToday >= 2
      ? "yes"
      : analyzeCyclesToday > 24 && closedToday <= 1
        ? "unclear"
        : "no";

  const missedGoodTrades: DailyReviewVerdict =
    input.missedHoldSignals >= 3 ? "yes" : input.missedHoldSignals > 0 ? "unclear" : "no";

  const tookBadTrades: DailyReviewVerdict =
    lossesToday >= 2 ? "yes" : lossesToday === 1 ? "partial" : winsToday > 0 ? "no" : "unclear";

  const riskGatesWorked: DailyReviewVerdict =
    loopActive || risk.blockNewTrades
      ? lossesToday === 0
        ? "yes"
        : "partial"
      : risk.riskStatus === "SAFE"
        ? "yes"
        : "partial";

  const executionWorked: DailyReviewVerdict =
    eq.liveQualityGate.status === "PASS"
      ? "yes"
      : eq.liveQualityGate.status === "WARNING"
        ? "partial"
        : "no";

  const improveParts: string[] = [];
  if (overtraded === "yes") {
    improveParts.push("Reduce analyze frequency in defensive/recovery — wait for higher conviction.");
  }
  if (lossesToday > 0) {
    improveParts.push("Review losing trade reflections before next testnet cycle.");
  }
  if (ctx.pendingLearning > 0) {
    improveParts.push(`Clear ${ctx.pendingLearning} pending learning review(s) on the dashboard.`);
  }
  if (eq.liveQualityGate.status !== "PASS") {
    improveParts.push("Inspect execution quality and testnet journal before auto-execute.");
  }
  if (mission.humanApprovalNeeded) {
    improveParts.push(mission.humanApprovalReason ?? mission.nextAction);
  }
  if (input.tradeQuality && input.tradeQuality.avgCompositeScore < 60) {
    improveParts.push(
      `Raise trade quality (avg ${input.tradeQuality.avgCompositeScore}/100) — focus on ${input.tradeQuality.weakestDimension ?? "entry"} dimension.`,
    );
  }
  if (improveParts.length === 0) {
    improveParts.push("Maintain mission mode discipline and double confirm on all testnet executes.");
  }

  return {
    followedMission: answer(
      followedMission,
      tradedWhilePaused
        ? `Trades closed while mission mode is ${mission.mode} — ${mission.modeReason}`
        : `Mission ${mission.mode}: ${mission.modeReason}`,
    ),
    overtraded: answer(
      overtraded,
      overtraded === "yes"
        ? `${analyzeCyclesToday} analyze cycles with ${closedToday} closed trade(s) in ${mission.mode} mode.`
        : `${analyzeCyclesToday} analyze cycles · ${closedToday} closed trade(s) today.`,
    ),
    missedGoodTrades: answer(
      missedGoodTrades,
      input.missedHoldSignals > 0
        ? `${input.missedHoldSignals} WAIT/SKIP verdict(s) today — committee may have passed setups.`
        : "No strong evidence of missed entries from today's journal.",
    ),
    tookBadTrades: answer(
      tookBadTrades,
      lossesToday > 0
        ? `${lossesToday} losing trade(s) today · net mission PnL ${snapshot.netPnl >= 0 ? "positive" : "negative"}.`
        : winsToday > 0
          ? `${winsToday} winning trade(s) — no material bad fills flagged.`
          : "No closed trades today to judge entry quality.",
    ),
    riskGatesWorked: answer(
      riskGatesWorked,
      loopActive
        ? `Loop guard active: ${ctx.loopGuard?.blocker.reason ?? "blocker"}`
        : risk.blockNewTrades
          ? `Risk engine blocked new trades · status ${risk.riskStatus}`
          : `Risk status ${risk.riskStatus} · ${risk.triggeredLimits.length} limit(s) triggered.`,
    ),
    executionWorked: answer(
      executionWorked,
      `Execution gate ${eq.liveQualityGate.status} · rejection ${eq.rejectionRatePct}% · failed ${eq.failedOrderCount}.`,
    ),
    improveTomorrow: improveParts.join(" "),
  };
}

export function buildDailySelfReviewRecord(input: {
  dateKey?: string;
  trigger: DailySelfReviewRecord["trigger"];
  mission: MissionControllerResult;
  snapshot: MissionFlowSnapshot;
  ctx: ParallelReviewContext;
  entries: DecisionLogEntry[];
  trades: GoalTradeRow[];
  tradeQuality?: TradeQualitySummary | null;
}): DailySelfReviewRecord {
  const dateKey = input.dateKey ?? utcDateKey();
  const entriesToday = filterEntriesForUtcDay(input.entries, dateKey);
  const tradesToday = filterTradesForUtcDay(input.trades, dateKey);
  const winsToday = tradesToday.filter((t) => t.result === "WIN").length;
  const lossesToday = tradesToday.filter((t) => t.result === "LOSS").length;
  const missedHoldSignals = entriesToday.filter(
    (e) => e.finalVerdict === "WAIT" || e.finalVerdict === "SKIP",
  ).length;

  const questions = buildDailyReviewQuestions({
    mission: input.mission,
    snapshot: input.snapshot,
    analyzeCyclesToday: entriesToday.length,
    tradesToday,
    winsToday,
    lossesToday,
    ctx: input.ctx,
    missedHoldSignals,
    tradeQuality: input.tradeQuality,
  });

  const dailyScore = computeDailyScore({
    mission: input.mission,
    analyzeCyclesToday: entriesToday.length,
    winsToday,
    lossesToday,
    dailyPnlPct: input.mission.inputs.dailyPnlPct,
    executionGate: input.ctx.executionQuality.liveQualityGate.status,
    riskBlocked: input.ctx.riskReport.blockNewTrades,
    duplicateSubmissions: input.ctx.executionQuality.duplicateSubmissionCount,
    missedHoldSignals,
  });

  const losingTrade = tradesToday.find((t) => t.result === "LOSS");
  const winningTrade = tradesToday.find((t) => t.result === "WIN");
  const bestEntry = entriesToday.find((e) => e.finalVerdict === "TRADE" && !e.riskVeto);

  const biggestMistake =
    questions.tookBadTrades.verdict === "yes" && losingTrade
      ? `Loss on ${losingTrade.symbol} ${losingTrade.side}: ${losingTrade.reason.slice(0, 120)}`
      : questions.overtraded.verdict === "yes"
        ? questions.overtraded.detail
        : questions.executionWorked.verdict === "no"
          ? questions.executionWorked.detail
          : dailyScore < 60
            ? questions.improveTomorrow.split(".")[0]
            : "No major mistake flagged — maintain discipline.";

  const bestDecision =
    winningTrade
      ? `Win on ${winningTrade.symbol}: ${winningTrade.reason.slice(0, 100)}`
      : bestEntry
        ? `Held conviction on TRADE at $${bestEntry.btcPrice.toLocaleString()} — ${bestEntry.topReasons[0] ?? bestEntry.actionPlan}`.slice(
            0,
            140,
          )
        : questions.riskGatesWorked.verdict === "yes" && input.ctx.riskReport.blockNewTrades
          ? "Risk gate blocked new trades before daily loss worsened."
          : `Stayed in ${input.mission.mode} mode per mission controller.`;

  const lessonLearned =
    lossesToday > 0
      ? `Today's losses (${lossesToday}) suggest tighter entry filters in ${input.mission.mode} mode.`
      : winsToday > 0
        ? `Winning day (${winsToday}W) — preserve ${input.mission.recommendedRiskLevel} risk and current strategy set.`
        : `No closed trades — focus on ${input.snapshot.trust.ready ? "quality entries" : `building trust sample (${input.snapshot.trust.completedTrades}/${input.snapshot.trust.minRequired})`}.`;

  const ruleProposal =
    questions.overtraded.verdict === "yes"
      ? "Cap testnet auto-execute to one attempt per 30 minutes when mission mode is DEFENSIVE or RECOVERY."
      : questions.riskGatesWorked.verdict === "partial"
        ? "Require loop-guard clearance before any testnet execute after two consecutive HOLD verdicts."
        : "Keep double confirm on all testnet executes — do not bypass for speed.";

  const strategyProposal =
    input.mission.mode === "RECOVERY"
      ? "Restrict to core strategies only until losing streak clears."
      : input.snapshot.strategyHealth?.status === "WARNING"
        ? "Pause non-primary strategies until strategy health returns to OK."
        : "Evaluate one Strategy Garage import via shadow before adding advisory signals.";

  const tomorrowPlan = [
    `Mission: stay in ${input.mission.mode} · ${input.mission.tradeFrequency} frequency.`,
    questions.improveTomorrow,
    input.snapshot.nextRecommendation,
  ]
    .filter(Boolean)
    .join(" ");

  const summary = [
    `Daily AI score ${dailyScore}/100 · ${dateKey}`,
    `Mission ${input.mission.mode} · ${winsToday}W/${lossesToday}L today`,
    `Lesson: ${lessonLearned}`,
    `Tomorrow: ${tomorrowPlan.slice(0, 200)}`,
  ].join(" · ");

  return {
    reviewId: `dsr-${dateKey}-${Date.now()}`,
    date: dateKey,
    generatedAt: new Date().toISOString(),
    trigger: input.trigger,
    dailyScore,
    biggestMistake,
    bestDecision,
    lessonLearned,
    ruleProposal,
    strategyProposal,
    tomorrowPlan,
    questions,
    summary,
    sourceCounts: {
      analyzeCyclesToday: entriesToday.length,
      tradesClosedToday: winsToday + lossesToday,
      lossesToday,
      winsToday,
      missionMode: input.mission.mode,
      executionGate: input.ctx.executionQuality.liveQualityGate.status,
      riskStatus: input.ctx.riskReport.riskStatus,
      tradeQualityAvg: input.tradeQuality?.avgCompositeScore ?? null,
      tradeQualityGrade: input.tradeQuality?.avgGrade ?? null,
    },
    safetyNotice: DAILY_SELF_REVIEW_SAFETY_NOTICE,
    advisoryOnly: true,
    cannotAutoChangeLive: true,
  };
}
