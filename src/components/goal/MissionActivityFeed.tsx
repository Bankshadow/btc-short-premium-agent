"use client";

import type { MissionFlowActivityItem } from "@/lib/mission-flow/types";

const STATUS_COLOR: Record<string, string> = {
  SUCCESS: "text-emerald-300",
  FAILED: "text-rose-300",
  SKIPPED: "text-amber-300",
  BLOCKED: "text-rose-300",
  RUNNING: "text-cyan-300",
};

export default function MissionActivityFeed({
  items,
  compact = false,
}: {
  items: MissionFlowActivityItem[];
  compact?: boolean;
}) {
  if (items.length === 0) {
    return (
      <section
        className={
          compact
            ? "rounded-lg border border-zinc-800/70 bg-zinc-950/40 p-3"
            : "rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5"
        }
      >
        <p className="text-xs uppercase tracking-wide text-zinc-500">Autopilot activity</p>
        <p className="mt-2 text-sm text-zinc-500">No cycles recorded yet — first run starts on schedule.</p>
      </section>
    );
  }

  return (
    <section
      className={
        compact
          ? "rounded-lg border border-zinc-800/70 bg-zinc-950/40 p-3"
          : "rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5"
      }
    >
      <p className="text-xs uppercase tracking-wide text-zinc-500">Autopilot activity</p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-zinc-800/60 px-3 py-2 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-zinc-500">
                {new Date(item.at).toLocaleString()} · {item.trigger}
              </span>
              <span className={STATUS_COLOR[item.status] ?? "text-zinc-400"}>
                {item.status}
                {item.verdict ? ` · ${item.verdict}` : ""}
              </span>
            </div>
            <p className="mt-1 text-zinc-300">{item.summary}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
