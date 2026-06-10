"use client";

import type { MicroLiveReadinessReviewSnapshot } from "@/lib/micro-live-readiness-review/types";

const STATUS_STYLE: Record<string, string> = {
  READY_FOR_REVIEW: "text-emerald-300 border-emerald-900/50 bg-emerald-950/20",
  NOT_READY: "text-amber-300 border-amber-900/50 bg-amber-950/20",
  BLOCKED: "text-rose-300 border-rose-900/50 bg-rose-950/20",
};

export function MicroLiveReadinessReviewBadge({
  review,
}: {
  review: MicroLiveReadinessReviewSnapshot | null | undefined;
}) {
  if (!review) return null;

  const style = STATUS_STYLE[review.readinessStatus] ?? STATUS_STYLE.NOT_READY;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${style}`}
      data-mvp="94"
      title={review.topBlocker ?? review.nextActions[0]}
    >
      Readiness {review.readinessStatus.replace(/_/g, " ")}
      <span className="opacity-70">{review.readinessScore}%</span>
    </span>
  );
}

export function MicroLiveReadinessReviewPanel({
  review,
}: {
  review: MicroLiveReadinessReviewSnapshot | null | undefined;
}) {
  if (!review) {
    return <p className="text-sm text-zinc-500">Readiness review loading…</p>;
  }

  const style = STATUS_STYLE[review.readinessStatus] ?? STATUS_STYLE.NOT_READY;

  return (
    <div className="space-y-4" data-mvp="94">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style}`}
        >
          {review.readinessStatus.replace(/_/g, " ")}
        </span>
        <span className="text-xs text-zinc-500">Score {review.readinessScore}%</span>
      </div>

      {review.nextActions[0] && (
        <p className="text-sm text-zinc-300">{review.nextActions[0]}</p>
      )}

      <ul className="space-y-2 text-xs">
        {review.checklist.map((item) => (
          <li
            key={item.id}
            className={item.passed ? "text-emerald-300/90" : "text-zinc-400"}
          >
            {item.passed ? "✓" : "○"} {item.label}
            {item.detail && !item.passed && (
              <span className="block pl-4 text-zinc-500">{item.detail}</span>
            )}
          </li>
        ))}
      </ul>

      {review.blockers.length > 0 && (
        <ul className="space-y-1 text-xs text-rose-300/90">
          {review.blockers.map((b) => (
            <li key={b}>Blocker: {b}</li>
          ))}
        </ul>
      )}

      <p className="rounded border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-[11px] text-zinc-400">
        {review.safetyNotice}
      </p>
    </div>
  );
}
