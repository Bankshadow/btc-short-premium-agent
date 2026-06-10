"use client";

import type { EngineEvent } from "@/lib/engine-event-bus/types";

const SEVERITY_CLASS: Record<EngineEvent["severity"], string> = {
  info: "border-zinc-800/70 text-zinc-400",
  success: "border-emerald-900/40 text-emerald-300/90",
  warning: "border-amber-900/40 text-amber-200/90",
  critical: "border-rose-900/40 text-rose-200/90",
};

export function EngineEventFeed({
  events,
  limit = 5,
  compact = false,
  title = "Engine events",
}: {
  events: EngineEvent[];
  limit?: number;
  compact?: boolean;
  title?: string;
}) {
  const slice = events.slice(0, limit);

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </h2>
      <ul className={`mt-3 space-y-2 ${compact ? "text-[11px]" : "text-xs"}`}>
        {slice.length === 0 ? (
          <li className="text-zinc-500">No engine events yet.</li>
        ) : (
          slice.map((ev) => (
            <li
              key={ev.id}
              className={`rounded border px-3 py-2 ${SEVERITY_CLASS[ev.severity]}`}
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-[10px] uppercase tracking-wide text-violet-400/80">
                  {ev.type.replace(/_/g, " ")}
                </span>
                <span className="text-zinc-500">
                  {new Date(ev.timestamp).toLocaleString()}
                </span>
              </div>
              <p className="mt-0.5 text-zinc-200">{ev.summary}</p>
              {!compact && (ev.runId || ev.decisionLogId || ev.tradeId) && (
                <p className="mt-1 font-mono text-[10px] text-zinc-600">
                  {ev.runId && `run ${ev.runId.slice(0, 14)}…`}
                  {ev.decisionLogId && ` · log ${ev.decisionLogId.slice(0, 12)}…`}
                  {ev.tradeId && ` · trade ${ev.tradeId.slice(0, 12)}…`}
                </p>
              )}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

export function EngineEventAlertBanner({ event }: { event: EngineEvent | null }) {
  if (!event) return null;
  const tone =
    event.severity === "critical"
      ? "border-rose-900/50 bg-rose-950/25 text-rose-100"
      : event.severity === "warning"
        ? "border-amber-900/50 bg-amber-950/25 text-amber-100"
        : "border-emerald-900/50 bg-emerald-950/25 text-emerald-100";

  return (
    <div className={`rounded-lg border px-4 py-2 text-xs ${tone}`}>
      <span className="font-semibold uppercase tracking-wide opacity-80">
        {event.type.replace(/_/g, " ")}
      </span>
      <p className="mt-0.5">{event.summary}</p>
    </div>
  );
}
