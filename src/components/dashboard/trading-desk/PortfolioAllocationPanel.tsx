"use client";

import type { PortfolioAllocation } from "@/lib/types/agent";

interface PortfolioAllocationPanelProps {
  allocation: PortfolioAllocation;
}

export default function PortfolioAllocationPanel({
  allocation,
}: PortfolioAllocationPanelProps) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Portfolio Allocation
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Staged growth ${allocation.initialCapitalUsd.toLocaleString()} → $
        {allocation.goalCapitalUsd.toLocaleString()}+
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Current capital" value={`$${allocation.currentCapitalUsd.toLocaleString()}`} />
        <Stat label="Goal progress" value={`${allocation.progressPct}%`} />
        <Stat
          label="Stage"
          value={`${allocation.currentStage.label} ($${allocation.currentStage.targetUsd.toLocaleString()})`}
        />
        <Stat
          label="Next milestone"
          value={
            allocation.nextStage
              ? `$${allocation.nextStage.targetUsd.toLocaleString()}`
              : "At goal path"
          }
        />
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100"
          style={{ width: `${allocation.progressPct}%` }}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-zinc-600 dark:text-zinc-400">
        <span>Max loss / trade: {allocation.maxLossPerTradePct}%</span>
        <span>Max daily loss: {allocation.maxDailyLossPct}%</span>
      </div>

      {allocation.split && (
        <div className="mt-4 rounded-lg border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Proposed capital split (on doubling)
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <p className="text-lg font-semibold">{allocation.split.reservePct}%</p>
              <p className="text-xs text-zinc-500">Reserve</p>
            </div>
            <div>
              <p className="text-lg font-semibold">{allocation.split.growthPct}%</p>
              <p className="text-xs text-zinc-500">Growth</p>
            </div>
            <div>
              <p className="text-lg font-semibold">
                {allocation.split.experimentalPct}%
              </p>
              <p className="text-xs text-zinc-500">Experimental</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-zinc-500">{allocation.split.rationale}</p>
        </div>
      )}

      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
        {allocation.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{value}</p>
    </div>
  );
}
