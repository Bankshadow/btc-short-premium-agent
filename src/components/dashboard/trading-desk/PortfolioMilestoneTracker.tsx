"use client";

import type { PortfolioMilestones } from "@/lib/agents/types";

interface PortfolioMilestoneTrackerProps {
  milestones: PortfolioMilestones;
}

export default function PortfolioMilestoneTracker({
  milestones,
}: PortfolioMilestoneTrackerProps) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Portfolio Milestone Tracker
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        $1,000 → $20,000 staged path. Split reserve / growth / experimental when
        capital doubles at a milestone.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {milestones.milestonesUsd.map((m) => (
          <span
            key={m}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              milestones.currentCapitalUsd >= m
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            ${m.toLocaleString()}
          </span>
        ))}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Current"
          value={`$${milestones.currentCapitalUsd.toLocaleString()}`}
        />
        <Stat label="Goal progress" value={`${milestones.progressPct}%`} />
        <Stat label="Stage" value={milestones.currentStage.label} />
        <Stat
          label="Risk caps"
          value={`${milestones.maxRiskPerTradePct}% / ${milestones.maxDailyLossPct}% / ${milestones.maxWeeklyLossPct}%`}
        />
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100"
          style={{ width: `${milestones.progressPct}%` }}
        />
      </div>

      {milestones.split && (
        <div className="mt-4 rounded-lg border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-sm font-medium">Recommended split (doubling)</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <p className="text-lg font-semibold">
                {milestones.split.reservePct}%
              </p>
              <p className="text-xs text-zinc-500">Reserve</p>
            </div>
            <div>
              <p className="text-lg font-semibold">
                {milestones.split.growthPct}%
              </p>
              <p className="text-xs text-zinc-500">Growth</p>
            </div>
            <div>
              <p className="text-lg font-semibold">
                {milestones.split.experimentalPct}%
              </p>
              <p className="text-xs text-zinc-500">Experimental</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            {milestones.split.rationale}
          </p>
        </div>
      )}

      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
        {milestones.notes.map((n) => (
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
      <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </p>
    </div>
  );
}
