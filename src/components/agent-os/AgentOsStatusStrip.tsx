"use client";

import type { AgentOsDashboardState } from "@/lib/agent-os/types";

type Props = {
  state: AgentOsDashboardState;
  compact?: boolean;
};

function modeColor(mode: AgentOsDashboardState["mode"]): string {
  const map: Record<AgentOsDashboardState["mode"], string> = {
    OBSERVE: "text-zinc-400 border-zinc-700",
    ANALYZE: "text-sky-300 border-sky-800/60",
    PAPER_AUTOPILOT: "text-violet-300 border-violet-800/60",
    TESTNET_ASSISTED: "text-cyan-300 border-cyan-800/60",
    TESTNET_ALLOW_ALL_SAFE: "text-amber-300 border-amber-800/60",
    LIVE_LOCKED: "text-rose-300 border-rose-800/60",
  };
  return map[mode];
}

export default function AgentOsStatusStrip({ state, compact = false }: Props) {
  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-2 text-xs">
        <span className={`rounded border px-2 py-0.5 font-semibold ${modeColor(state.mode)}`}>
          {state.modeLabel}
        </span>
        <span className="text-zinc-500">
          Permission:{" "}
          <span className={state.permissionNeeded ? "text-amber-300" : "text-emerald-300"}>
            {state.permissionNeeded ? "Yes" : "No"}
          </span>
        </span>
        {state.goalProgressPct != null && (
          <span className="text-zinc-500">
            Goal: <span className="text-emerald-300">{state.goalProgressPct}%</span>
          </span>
        )}
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
          Trading Agent OS · Think · Act · Ask
        </p>
        <span className="rounded border border-rose-900/50 bg-rose-950/30 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-300">
          Live locked
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">AI mode</p>
          <p className={`mt-1 text-sm font-semibold ${modeColor(state.mode).split(" ")[0]}`}>
            {state.modeLabel}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">Current action</p>
          <p className="mt-1 text-xs text-zinc-300">{state.currentAction}</p>
        </div>
        <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">Permission needed?</p>
          <p
            className={`mt-1 text-sm font-semibold ${
              state.permissionNeeded ? "text-amber-300" : "text-emerald-300"
            }`}
          >
            {state.permissionNeeded ? "Yes" : "No"}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">Next action</p>
          <p className="mt-1 text-xs text-zinc-300">{state.nextAction}</p>
        </div>
        <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">Goal progress</p>
          <p className="mt-1 text-sm font-semibold text-emerald-300">
            {state.goalProgressPct != null ? `${state.goalProgressPct}%` : "—"}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-[11px] text-zinc-500 sm:grid-cols-3">
        <p>
          <span className="text-zinc-600">Think:</span> {state.thinksActsAsks.think}
        </p>
        <p>
          <span className="text-zinc-600">Act:</span> {state.thinksActsAsks.act}
        </p>
        <p>
          <span className="text-zinc-600">Ask:</span> {state.thinksActsAsks.ask}
        </p>
      </div>
    </section>
  );
}
