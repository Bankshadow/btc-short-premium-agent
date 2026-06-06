"use client";

import Link from "next/link";
import type { MissionFlowStrategyHealth } from "@/lib/mission-flow/types";

export default function StrategyHealthBanner({
  strategy,
}: {
  strategy: MissionFlowStrategyHealth | null;
}) {
  if (!strategy) return null;

  const tone = strategy.tradeAllowed
    ? "border-emerald-900/40 bg-emerald-950/15"
    : "border-amber-900/50 bg-amber-950/20";

  return (
    <section className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Active strategy</p>
          <p className="mt-1 font-mono text-base text-zinc-100">{strategy.label}</p>
          <p className="mt-1 text-xs text-zinc-400">
            {strategy.status.replace(/_/g, " ")} · {strategy.recommendation}
            {strategy.healthScorePct != null ? ` · health ${strategy.healthScorePct}%` : ""}
          </p>
          {!strategy.tradeAllowed && strategy.blockReason && (
            <p className="mt-2 text-xs text-amber-300">{strategy.blockReason}</p>
          )}
        </div>
        <div className="text-right text-xs text-zinc-500">
          <p>{strategy.sampleSize} samples</p>
          <p>{strategy.winRate}% win rate</p>
          <Link href="/strategy-health" className="mt-2 inline-block text-emerald-300 hover:underline">
            Strategy health →
          </Link>
        </div>
      </div>
    </section>
  );
}
