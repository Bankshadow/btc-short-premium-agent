"use client";

import type { MonitorReliabilitySnapshot } from "@/lib/monitor-reliability/types";

const HEALTH_STYLE: Record<string, string> = {
  OK: "text-emerald-400 border-emerald-900/50 bg-emerald-950/20",
  WARNING: "text-amber-300 border-amber-900/50 bg-amber-950/20",
  BLOCKED: "text-rose-300 border-rose-900/50 bg-rose-950/20",
};

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export default function MonitorReliabilityPanel({
  reliability,
  compact = false,
}: {
  reliability: MonitorReliabilitySnapshot | null | undefined;
  compact?: boolean;
}) {
  if (!reliability) {
    return (
      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <p className="text-sm text-zinc-500">Monitor reliability loading…</p>
      </section>
    );
  }

  const hb = reliability.heartbeat;
  const healthClass = HEALTH_STYLE[reliability.health] ?? HEALTH_STYLE.WARNING;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] ${healthClass}`}
      >
        Monitor {reliability.health}
      </span>
    );
  }

  return (
    <section
      className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4"
      data-mvp="73B"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-violet-400/80">
            MVP 73B · {reliability.label}
          </p>
          <p
            className={`mt-2 inline-flex rounded-lg border px-3 py-1 text-sm font-semibold ${healthClass}`}
          >
            Monitor health: {reliability.health}
          </p>
        </div>
        {reliability.blocksNewEntries && (
          <p className="text-xs text-rose-300">New entries blocked — position state uncertain</p>
        )}
      </div>

      {reliability.currentIssue && (
        <p className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-300">
          Current issue: {reliability.currentIssue}
        </p>
      )}

      {reliability.recoveryAction && (
        <p className="mt-2 text-xs text-zinc-400">
          Recovery: {reliability.recoveryAction}
        </p>
      )}

      <dl className="mt-4 grid gap-2 text-[11px] sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">Last monitor run</dt>
          <dd className="font-mono text-zinc-300">{fmtTime(hb.lastMonitorRunAt)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Last position refresh</dt>
          <dd className="font-mono text-zinc-300">{fmtTime(hb.lastPositionRefreshAt)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Last close check</dt>
          <dd className="font-mono text-zinc-300">{fmtTime(hb.lastCloseCheckAt)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Last journal write</dt>
          <dd className="font-mono text-zinc-300">{fmtTime(hb.lastJournalWriteAt)}</dd>
        </div>
      </dl>

      {reliability.issues.filter((i) => !i.recovered).length > 0 && (
        <ul className="mt-3 space-y-1 text-[11px] text-amber-300/90">
          {reliability.issues
            .filter((i) => !i.recovered)
            .slice(0, 6)
            .map((issue) => (
              <li key={`${issue.kind}-${issue.symbol}-${issue.message}`}>
                {issue.symbol ? `${issue.symbol}: ` : ""}
                {issue.message}
              </li>
            ))}
        </ul>
      )}

      <p className="mt-3 text-[10px] text-zinc-600">
        Close remains reduce-only · no blind retry · live trading stays locked.
      </p>
    </section>
  );
}
