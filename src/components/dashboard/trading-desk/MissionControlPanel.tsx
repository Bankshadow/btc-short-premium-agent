"use client";

import type { MissionControlStatus } from "@/lib/agents/types";
import { deskHealthClass } from "./agent-display";

interface MissionControlPanelProps {
  mission: MissionControlStatus;
}

export default function MissionControlPanel({
  mission,
}: MissionControlPanelProps) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-gradient-to-br from-zinc-900 to-zinc-800 p-5 text-zinc-50 dark:border-zinc-700">
      <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
        Mission Control
      </p>
      <h2 className="mt-1 text-xl font-bold">Multi-Agent AI Trading Desk</h2>
      <p className="mt-2 text-sm text-zinc-300">
        Options · Spot · Futures — analysis-only with human approval
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Mode" value="Analysis only" />
        <Stat label="Auto execution" value="Disabled" />
        <Stat label="Private API keys" value="Not required" />
        <Stat
          label="Desk health"
          value={mission.deskHealth}
          className={deskHealthClass(mission.deskHealth)}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <Badge>Human approval required</Badge>
        <Badge>{mission.activeAgents} agents active</Badge>
        <Badge>No martingale</Badge>
        <Badge>No real orders</Badge>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-lg bg-white/5 px-3 py-2">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold capitalize ${className}`}>
        {value}
      </p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/20 px-2.5 py-1">
      {children}
    </span>
  );
}
