"use client";

import type { DailySelfReviewRecord } from "@/lib/daily-self-review/types";
import { DAILY_SELF_REVIEW_SAFETY_NOTICE } from "@/lib/daily-self-review/types";

function scoreTone(score: number): string {
  if (score >= 75) return "text-emerald-300";
  if (score >= 50) return "text-amber-300";
  return "text-rose-300";
}

function verdictLabel(verdict: string): string {
  return verdict.toUpperCase();
}

export default function DailySelfReviewPanel({
  review,
  busy,
  onRun,
}: {
  review: DailySelfReviewRecord | null;
  busy?: boolean;
  onRun?: () => void;
}) {
  if (!review) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-400">
          No daily AI self-review yet. Run the end-of-day review to score mission discipline,
          trading quality, and tomorrow&apos;s plan.
        </p>
        {onRun && (
          <button
            type="button"
            disabled={busy}
            onClick={onRun}
            className="rounded-lg border border-violet-800/60 bg-violet-950/30 px-3 py-1.5 text-xs text-violet-200 hover:bg-violet-950/50 disabled:opacity-50"
          >
            {busy ? "Running..." : "Run daily self-review"}
          </button>
        )}
        <p className="text-[10px] text-zinc-600">{DAILY_SELF_REVIEW_SAFETY_NOTICE}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Daily AI Score</p>
          <p className={`text-4xl font-semibold tabular-nums ${scoreTone(review.dailyScore)}`}>
            {review.dailyScore}
            <span className="text-lg text-zinc-500">/100</span>
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {review.date} · {review.sourceCounts.missionMode} ·{" "}
            {review.sourceCounts.winsToday}W / {review.sourceCounts.lossesToday}L today
          </p>
        </div>
        {onRun && (
          <button
            type="button"
            disabled={busy}
            onClick={onRun}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900/60 disabled:opacity-50"
          >
            {busy ? "..." : "Re-run"}
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3">
          <p className="text-[10px] uppercase tracking-wide text-emerald-400/80">Lesson learned</p>
          <p className="mt-1 text-sm text-emerald-100/90">{review.lessonLearned}</p>
        </div>
        <div className="rounded-lg border border-sky-900/40 bg-sky-950/20 p-3">
          <p className="text-[10px] uppercase tracking-wide text-sky-400/80">Tomorrow&apos;s plan</p>
          <p className="mt-1 text-sm text-sky-100/90">{review.tomorrowPlan}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-rose-400/80">Biggest mistake</p>
          <p className="mt-1 text-xs text-zinc-400">{review.biggestMistake}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-emerald-400/80">Best decision</p>
          <p className="mt-1 text-xs text-zinc-400">{review.bestDecision}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-violet-400/80">Rule proposal</p>
          <p className="mt-1 text-xs text-zinc-400">{review.ruleProposal}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-cyan-400/80">Strategy proposal</p>
          <p className="mt-1 text-xs text-zinc-400">{review.strategyProposal}</p>
        </div>
      </div>

      <details className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
        <summary className="cursor-pointer text-xs font-medium text-zinc-400">
          Daily questions ({review.questions.followedMission.verdict} mission alignment)
        </summary>
        <ul className="mt-3 space-y-2 text-xs text-zinc-500">
          {(
            [
              ["Followed mission?", review.questions.followedMission],
              ["Overtraded?", review.questions.overtraded],
              ["Missed good trades?", review.questions.missedGoodTrades],
              ["Took bad trades?", review.questions.tookBadTrades],
              ["Risk gates worked?", review.questions.riskGatesWorked],
              ["Execution worked?", review.questions.executionWorked],
            ] as const
          ).map(([label, q]) => (
            <li key={label}>
              <span className="text-zinc-400">{label}</span>{" "}
              <span className="font-mono text-[10px] text-zinc-600">
                {verdictLabel(q.verdict)}
              </span>
              <span className="block text-zinc-600">{q.detail}</span>
            </li>
          ))}
          <li>
            <span className="text-zinc-400">Improve tomorrow?</span>
            <span className="block text-zinc-600">{review.questions.improveTomorrow}</span>
          </li>
        </ul>
      </details>

      <p className="text-[10px] text-zinc-600">{DAILY_SELF_REVIEW_SAFETY_NOTICE}</p>
    </div>
  );
}
