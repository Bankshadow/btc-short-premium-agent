"use client";

import type { DeskPortfolioSnapshot } from "@/lib/portfolio/portfolio-types";

interface PortfolioMilestonesPanelProps {
  portfolio: DeskPortfolioSnapshot;
}

function statusStyle(status: DeskPortfolioSnapshot["milestones"][0]["status"]): string {
  switch (status) {
    case "achieved":
      return "border-emerald-900/50 bg-emerald-950/30 text-emerald-300";
    case "in_progress":
      return "border-amber-900/50 bg-amber-950/20 text-amber-200";
    default:
      return "border-zinc-800 bg-zinc-950/50 text-zinc-500";
  }
}

export default function PortfolioMilestonesPanel({
  portfolio,
}: PortfolioMilestonesPanelProps) {
  return (
    <section className="desk-panel border-teal-900/40">
      <div className="border-b border-zinc-800 px-4 py-3">
        <p className="desk-section-title text-teal-400/90">Portfolio desk · MVP 6</p>
        <h2 className="text-sm font-semibold text-zinc-100">Milestones & book stats</h2>
        <p className="mt-1 font-mono text-[10px] text-zinc-500">
          Log PnL {portfolio.netLogPaperPnlPct >= 0 ? "+" : ""}
          {portfolio.netLogPaperPnlPct}% · resolved {portfolio.resolvedLogCount} ·
          streak W{portfolio.streakWins} / L{portfolio.streakLosses}
        </p>
      </div>

      <div className="grid gap-2 p-4 sm:grid-cols-3">
        {portfolio.milestones.map((m) => (
          <div
            key={m.id}
            className={`rounded-lg border px-3 py-2 ${statusStyle(m.status)}`}
          >
            <p className="text-xs font-medium">{m.title}</p>
            <p className="mt-0.5 text-[10px] opacity-80">{m.description}</p>
            {m.status === "in_progress" && (
              <div className="mt-2 h-1 overflow-hidden rounded bg-zinc-800">
                <div
                  className="h-full bg-amber-500/70"
                  style={{ width: `${m.progressPct}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
