"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { AiStatusCardState } from "@/lib/ai-status/types";
import { AI_STATUS_SAFETY_NOTICE } from "@/lib/ai-status/types";

type Props = {
  card: AiStatusCardState;
  busy?: boolean;
  showTechnical?: boolean;
  compact?: boolean;
  onLoopGuardAction?: () => void;
};

function progressColor(pct: number): string {
  if (pct >= 90) return "from-emerald-600 to-emerald-400";
  if (pct >= 50) return "from-sky-600 to-cyan-400";
  if (pct > 0) return "from-indigo-600 to-violet-400";
  return "from-zinc-700 to-zinc-600";
}

export default function AIStatusCard({
  card,
  busy = false,
  showTechnical = false,
  compact = false,
  onLoopGuardAction,
}: Props) {
  const [loopBusy, setLoopBusy] = useState(false);
  const loop = card.loopBlocker;

  const runLoopAction = useCallback(
    async (path: "/api/autopilot-loop-guard/continue" | "/api/autopilot-loop-guard/clear") => {
      setLoopBusy(true);
      try {
        await fetch(path, { method: "POST" });
        onLoopGuardAction?.();
      } finally {
        setLoopBusy(false);
      }
    },
    [onLoopGuardAction],
  );

  if (compact) {
    return (
      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-zinc-200">{card.currentTask}</p>
          <span className="font-mono text-xs text-emerald-300">{card.progressPct}%</span>
        </div>
        <p className="mt-1 text-[11px] text-zinc-500">{card.currentStep}</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-indigo-900/40 bg-gradient-to-br from-zinc-950/90 to-indigo-950/20 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-400/80">
            AI Status · Live
          </p>
          <h2 className="mt-0.5 text-sm font-semibold text-zinc-100">{card.currentTask}</h2>
        </div>
        <div className="flex items-center gap-2">
          {card.isActive && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          )}
          <span className="rounded border border-rose-900/50 bg-rose-950/30 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-300">
            Live locked
          </span>
          {busy && <span className="text-[10px] text-zinc-600">syncing…</span>}
        </div>
      </div>

      <div className="mb-3">
        <div className="mb-1 flex justify-between text-[10px] text-zinc-500">
          <span>{card.currentStep}</span>
          <span className="font-mono text-zinc-300">{card.progressPct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${progressColor(card.progressPct)}`}
            style={{ width: `${Math.min(100, Math.max(0, card.progressPct))}%` }}
          />
        </div>
      </div>

      {card.committeeSummary && (
        <div className="mb-3 rounded-lg border border-indigo-900/40 bg-indigo-950/20 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-400/80">
            Agent committee · {card.committeeSummary.recommendation}
          </p>
          <p className="mt-1 text-xs text-indigo-100/90">{card.committeeSummary.summary}</p>
          {card.committeeSummary.topReasons.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[11px] text-zinc-400">
              {card.committeeSummary.topReasons.map((r) => (
                <li key={r}>· {r}</li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-[10px] text-zinc-600">
            {card.committeeSummary.agentCount} agents · {card.committeeSummary.actionItemCount}{" "}
            action item(s) · execution serialized
          </p>
        </div>
      )}

      {card.memorySummary && (
        <div className="mb-3 rounded-lg border border-violet-900/40 bg-violet-950/20 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-400/80">
            Second brain
          </p>
          <p className="mt-1 text-xs text-violet-100/90">{card.memorySummary.headline}</p>
          {card.memorySummary.topLessons.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[11px] text-zinc-400">
              {card.memorySummary.topLessons.slice(0, 2).map((l) => (
                <li key={l}>· {l}</li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-[10px] text-zinc-600">
            {card.memorySummary.lessonCount} lesson(s) · {card.memorySummary.subconsciousCount}{" "}
            stored · advisory only
          </p>
        </div>
      )}

      {(loop.active || loop.riskLevel === "SUSPICIOUS") && (
        <div
          className={`mb-3 rounded-lg border px-3 py-2 ${
            loop.active
              ? "border-rose-900/50 bg-rose-950/30"
              : "border-amber-900/50 bg-amber-950/20"
          }`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Loop guard · {loop.riskLevel ?? "—"}
          </p>
          {loop.reason && (
            <p className="mt-1 text-xs text-rose-200/90">{loop.reason}</p>
          )}
          {(loop.actionDiversityPct != null || loop.successRatePct != null) && (
            <p className="mt-1 text-[11px] text-zinc-500">
              Diversity {loop.actionDiversityPct ?? "—"}% · success{" "}
              {loop.successRatePct ?? "—"}%
            </p>
          )}
          {loop.selfCheckSummary && showTechnical && (
            <p className="mt-2 text-[10px] text-zinc-600">{loop.selfCheckSummary}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {loop.riskLevel === "SUSPICIOUS" && !loop.active && (
              <button
                type="button"
                disabled={loopBusy || busy}
                onClick={() => void runLoopAction("/api/autopilot-loop-guard/continue")}
                className="rounded border border-amber-800/60 bg-amber-950/40 px-2 py-1 text-[10px] font-medium text-amber-200 hover:bg-amber-900/40 disabled:opacity-50"
              >
                Approve one cycle
              </button>
            )}
            {loop.active && (
              <button
                type="button"
                disabled={loopBusy || busy}
                onClick={() => void runLoopAction("/api/autopilot-loop-guard/clear")}
                className="rounded border border-rose-800/60 bg-rose-950/40 px-2 py-1 text-[10px] font-medium text-rose-200 hover:bg-rose-900/40 disabled:opacity-50"
              >
                Clear blocker
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">Permission needed?</p>
          <p
            className={`mt-1 text-sm font-semibold ${
              card.permissionNeeded ? "text-amber-300" : "text-emerald-300"
            }`}
          >
            {card.permissionNeeded ? "Yes" : "No"}
          </p>
          {card.permissionReason && (
            <p className="mt-0.5 text-[11px] text-amber-200/80">{card.permissionReason}</p>
          )}
        </div>
        <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">Next action</p>
          <p className="mt-1 text-xs text-zinc-300">{card.estimatedNextAction}</p>
        </div>
      </div>

      <div className="mt-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
          Recent tool actions
        </p>
        {card.recentToolActions.length === 0 ? (
          <p className="text-xs text-zinc-500">No recent actions — run a desk cycle.</p>
        ) : (
          <ul className="space-y-1">
            {card.recentToolActions.map((action) => (
              <li
                key={action.id}
                className="flex items-start justify-between gap-2 rounded border border-zinc-800/60 bg-zinc-950/30 px-2 py-1.5 text-[11px]"
              >
                <span className="text-zinc-300">{action.label}</span>
                <span className="shrink-0 text-zinc-600">
                  {new Date(action.timestamp).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        )}
        {showTechnical && card.recentToolActions.some((a) => a.technical) && (
          <ul className="mt-2 space-y-0.5 font-mono text-[10px] text-zinc-600">
            {card.recentToolActions
              .filter((a) => a.technical)
              .map((a) => (
                <li key={`tech-${a.id}`}>{a.technical}</li>
              ))}
          </ul>
        )}
      </div>

      <p className="mt-3 text-[10px] text-zinc-600">
        {AI_STATUS_SAFETY_NOTICE}{" "}
        <Link href="/ai-status" className="text-indigo-400 hover:underline">
          Full status →
        </Link>
      </p>
    </section>
  );
}
