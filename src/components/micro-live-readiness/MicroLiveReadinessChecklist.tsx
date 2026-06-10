"use client";

import type { MicroLiveReadinessSnapshot } from "@/lib/micro-live-readiness/types";

export default function MicroLiveReadinessChecklist({
  readiness,
}: {
  readiness: MicroLiveReadinessSnapshot | null | undefined;
}) {
  if (!readiness) {
    return (
      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <p className="text-sm text-zinc-500">Micro-live readiness loading…</p>
      </section>
    );
  }

  const report = readiness.report;

  return (
    <section
      className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4"
      data-mvp="75"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-emerald-400/80">
            MVP 75 · {readiness.label}
          </p>
          <p className="mt-1 text-sm text-zinc-200">
            {report.readinessStatus.replace(/_/g, " ")} · score {report.readinessScore}%
          </p>
        </div>
        <p className="text-[10px] text-zinc-500">Live trading locked</p>
      </div>

      {report.blockers.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-rose-300/90">
          {report.blockers.map((b) => (
            <li key={b}>Blocker: {b}</li>
          ))}
        </ul>
      )}

      {report.warnings.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-amber-300/80">
          {report.warnings.map((w) => (
            <li key={w}>Warning: {w}</li>
          ))}
        </ul>
      )}

      <ul className="mt-4 space-y-2">
        {report.checklist.map((item) => (
          <li
            key={item.id}
            className="flex items-start gap-2 rounded-lg border border-zinc-800/60 px-3 py-2 text-xs"
          >
            <span className={item.passed ? "text-emerald-400" : "text-rose-400"}>
              {item.passed ? "✓" : "✗"}
            </span>
            <div>
              <p className="text-zinc-200">{item.label}</p>
              {item.detail && (
                <p className="text-zinc-500">{item.detail}</p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {report.evidenceLinks.length > 0 && (
        <p className="mt-3 text-[10px] text-zinc-500">
          {report.evidenceLinks.length} evidence link(s) ·{" "}
          {report.nextRequiredActions[0]}
        </p>
      )}

      <p className="mt-3 text-[10px] text-zinc-600">
        Assessment only — does not enable live trading or increase risk.
      </p>
    </section>
  );
}
