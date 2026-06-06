import type { MissionFlowSnapshot } from "@/lib/mission-flow/types";

export default function TrustMeter({
  trust,
  compact = false,
}: {
  trust: MissionFlowSnapshot["trust"];
  compact?: boolean;
}) {
  const pct = Math.min(
    100,
    Math.round((trust.completedTrades / trust.minRequired) * 100),
  );

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-[10px] text-zinc-500">
        <span>Trust</span>
        <span className="font-mono text-zinc-300">
          {trust.completedTrades}/{trust.minRequired}
        </span>
        {trust.ready && <span className="text-emerald-400">ready</span>}
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wide text-zinc-500">
          Trust progress
        </p>
        <p className="font-mono text-sm text-zinc-200">
          {trust.completedTrades} / {trust.minRequired}
        </p>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full ${trust.ready ? "bg-emerald-500" : "bg-amber-500/80"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-zinc-500">
        {trust.ready
          ? "Performance can be trusted for mission decisions."
          : `${trust.minRequired - trust.completedTrades} more completed trade(s) needed.`}
      </p>
    </section>
  );
}
