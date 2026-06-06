"use client";

import type { DeskBackboneHealth } from "@/lib/data-backbone/types";

type Props = {
  health: DeskBackboneHealth | null;
  compact?: boolean;
};

export default function DataHealthPanel({ health, compact }: Props) {
  if (!health) {
    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 text-xs text-zinc-500">
        Trade data is not connected yet. Run your first AI cycle or connect Binance Testnet.
      </section>
    );
  }

  const tone = health.healthy
    ? "border-emerald-800/50 bg-emerald-950/20 text-emerald-200"
    : "border-amber-800/50 bg-amber-950/20 text-amber-200";

  return (
    <section className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Data backbone</h2>
        <span className="text-[10px] uppercase tracking-wide opacity-80">
          {health.healthy ? "Healthy" : "Needs attention"}
        </span>
      </div>

      <div className={`mt-3 grid gap-2 ${compact ? "text-[11px]" : "text-xs"} text-zinc-300`}>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Source</span>
          <span className="font-mono">{health.source}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Last write</span>
          <span className="font-mono">
            {health.lastWriteAt ? new Date(health.lastWriteAt).toLocaleString() : "—"}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Sync</span>
          <span>{health.syncStatus}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Live mode</span>
          <span>{health.liveModeAllowed ? "Allowed (gates still apply)" : "Blocked"}</span>
        </div>
      </div>

      {health.staleWarning && (
        <p className="mt-2 text-[11px] text-amber-300/90">{health.staleWarning}</p>
      )}

      {health.missingFields.length > 0 && (
        <p className="mt-2 text-[11px] text-rose-300/90">
          Missing: {health.missingFields.join(", ")}
        </p>
      )}

      {health.writeBlockers.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11px] text-rose-200/80">
          {health.writeBlockers.slice(0, 4).map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
