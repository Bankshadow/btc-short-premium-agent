"use client";

import type { MissionFlowLearningInsights } from "@/lib/mission-flow/types";

function usd(n: number): string {
  const sign = n < 0 ? "-" : "+";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

export default function LearningInsightsPanel({
  insights,
  compact = false,
}: {
  insights: MissionFlowLearningInsights;
  compact?: boolean;
}) {
  if (insights.learnedCount === 0) return null;

  return (
    <section
      className={
        compact
          ? "rounded-lg border border-violet-900/30 bg-violet-950/10 p-3"
          : "rounded-xl border border-violet-900/40 bg-violet-950/15 p-5"
      }
    >
      <p className="text-xs uppercase tracking-wide text-violet-300/80">Learning insights</p>
      <p className="mt-1 text-sm text-zinc-200">
        {insights.learnedCount} learned · {insights.winCount}W / {insights.lossCount}L
        {insights.avgR != null ? ` · avg R ${insights.avgR}` : ""}
      </p>

      {insights.recent.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-xs text-zinc-400">
          {insights.recent.map((r, i) => (
            <li key={`${r.symbol}-${r.updatedAt}-${i}`} className="flex justify-between gap-2">
              <span>
                <span className="font-mono text-zinc-200">{r.symbol}</span> · {r.result} · R{" "}
                {r.rMultiple.toFixed(2)}
              </span>
              <span>{usd(r.netPnl)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
