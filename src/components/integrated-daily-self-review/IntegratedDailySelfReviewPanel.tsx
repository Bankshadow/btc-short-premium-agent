"use client";

import Link from "next/link";
import type { IntegratedDailySelfReviewSnapshot } from "@/lib/integrated-daily-self-review/types";
import { INTEGRATED_DAILY_SELF_REVIEW_SAFETY_NOTICE } from "@/lib/integrated-daily-self-review/types";

function formatPnl(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

export function DailySelfReviewBadge({
  dailyReview,
}: {
  dailyReview: IntegratedDailySelfReviewSnapshot | null | undefined;
}) {
  const review = dailyReview?.review;
  if (!review?.oneLineSummary) return null;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-violet-900/50 bg-violet-950/20 px-2.5 py-0.5 text-[10px] font-medium text-violet-300"
      data-mvp="79"
      title={review.tomorrowPlan}
    >
      Daily review · {review.oneLineSummary}
    </span>
  );
}

export function IntegratedDailySelfReviewPanel({
  dailyReview,
  showCursorTask = true,
}: {
  dailyReview: IntegratedDailySelfReviewSnapshot | null | undefined;
  showCursorTask?: boolean;
}) {
  const review = dailyReview?.review;
  if (!review) {
    return <p className="text-sm text-zinc-500">Daily AI self-review loading…</p>;
  }

  return (
    <div className="space-y-4" data-mvp="79">
      <div>
        <p className="text-sm text-zinc-300">
          {review.date} · {review.missionProgress}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {review.tradesToday} trade(s) today · PnL {formatPnl(review.pnlToday)}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3">
          <p className="text-[10px] uppercase tracking-wide text-emerald-400/80">Best decision</p>
          <p className="mt-1 text-xs text-emerald-100/90">{review.bestDecision}</p>
        </div>
        <div className="rounded-lg border border-rose-900/40 bg-rose-950/20 p-3">
          <p className="text-[10px] uppercase tracking-wide text-rose-400/80">Worst decision</p>
          <p className="mt-1 text-xs text-rose-100/90">{review.worstDecision}</p>
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wide text-amber-400/80">Biggest mistake</p>
        <p className="mt-1 text-xs text-zinc-400">{review.biggestMistake}</p>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wide text-zinc-500">Risk behavior</p>
        <p className="mt-1 text-xs text-zinc-400">{review.riskBehavior}</p>
      </div>

      {review.executionIssues.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Execution issues</p>
          <ul className="mt-1 space-y-1 text-xs text-zinc-400">
            {review.executionIssues.map((issue) => (
              <li key={issue}>· {issue}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="text-[10px] uppercase tracking-wide text-sky-400/80">Lessons learned</p>
        <ul className="mt-1 space-y-1 text-xs text-zinc-400">
          {review.lessonsLearned.map((lesson) => (
            <li key={lesson}>· {lesson}</li>
          ))}
        </ul>
        {review.linkedLearningRecordIds.length > 0 && (
          <Link
            href="/learning"
            className="mt-2 inline-block text-[11px] text-indigo-300 hover:underline"
          >
            View {review.linkedLearningRecordIds.length} linked learning record(s) →
          </Link>
        )}
      </div>

      <div className="rounded-lg border border-sky-900/40 bg-sky-950/20 p-3">
        <p className="text-[10px] uppercase tracking-wide text-sky-400/80">Tomorrow&apos;s plan</p>
        <p className="mt-1 text-xs text-sky-100/90">{review.tomorrowPlan}</p>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wide text-violet-400/80">
          Suggested strategy adjustment (advisory)
        </p>
        <p className="mt-1 text-xs text-zinc-400">{review.suggestedStrategyAdjustment}</p>
      </div>

      {showCursorTask && (
        <details className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
          <summary className="cursor-pointer text-xs font-medium text-zinc-400">
            Suggested Cursor task (Project Strategist)
          </summary>
          <pre className="mt-2 whitespace-pre-wrap font-mono text-[10px] text-zinc-500">
            {review.suggestedCursorTask}
          </pre>
          <Link
            href="/project-strategist"
            className="mt-2 inline-block text-[11px] text-indigo-300 hover:underline"
          >
            Open Project Strategist →
          </Link>
        </details>
      )}

      <p className="rounded border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-200/90">
        Advisory only — no automatic strategy change. Live trading remains locked.
      </p>

      <p className="text-[10px] text-zinc-600">{INTEGRATED_DAILY_SELF_REVIEW_SAFETY_NOTICE}</p>
    </div>
  );
}
