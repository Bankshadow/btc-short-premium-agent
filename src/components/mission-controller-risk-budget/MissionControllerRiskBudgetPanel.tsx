"use client";

import type { MissionControllerRiskBudgetSnapshot } from "@/lib/mission-controller-risk-budget/types";

const MODE_STYLE: Record<string, string> = {
  PAUSED: "text-rose-300 border-rose-900/50 bg-rose-950/30",
  COOLDOWN: "text-orange-300 border-orange-900/50 bg-orange-950/20",
  DEFENSIVE: "text-amber-300 border-amber-900/50 bg-amber-950/20",
  NORMAL: "text-emerald-300 border-emerald-900/50 bg-emerald-950/20",
  OPPORTUNITY: "text-cyan-300 border-cyan-900/50 bg-cyan-950/20",
};

export function MissionControllerRiskBudgetBadge({
  snapshot,
}: {
  snapshot: MissionControllerRiskBudgetSnapshot | null | undefined;
}) {
  if (!snapshot) return null;

  const style = MODE_STYLE[snapshot.missionMode] ?? MODE_STYLE.NORMAL;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${style}`}
      data-mvp="92"
      title={snapshot.modeReason}
    >
      Mission mode: {snapshot.missionMode}
    </span>
  );
}

export function MissionControllerRiskBudgetPanel({
  snapshot,
}: {
  snapshot: MissionControllerRiskBudgetSnapshot | null | undefined;
}) {
  if (!snapshot) {
    return (
      <p className="text-sm text-zinc-500">Mission controller analysis loading…</p>
    );
  }

  const style = MODE_STYLE[snapshot.missionMode] ?? MODE_STYLE.NORMAL;

  return (
    <div className="space-y-4" data-mvp="92">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style}`}
        >
          Mission mode: {snapshot.missionMode}
        </span>
        <span className="text-xs text-zinc-500">
          Progress {snapshot.inputs.progressPct.toFixed(0)}% to $
          {snapshot.inputs.targetEquity.toLocaleString()}
        </span>
      </div>

      <p className="text-sm text-zinc-300">{snapshot.modeReason}</p>
      <p className="text-xs text-violet-300/90">Next: {snapshot.nextAction}</p>

      <dl className="grid gap-2 text-[11px] sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-zinc-500">Risk / trade</dt>
          <dd className="font-mono text-zinc-300">
            {snapshot.recommendedRiskPerTrade}%
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Max notional</dt>
          <dd className="font-mono text-zinc-300">
            ${snapshot.recommendedMaxNotional}
            {snapshot.recommendedMaxNotional < snapshot.currentMaxNotional && (
              <span className="text-amber-300/80">
                {" "}
                (cap ${snapshot.currentMaxNotional})
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Daily loss limit</dt>
          <dd className="font-mono text-zinc-300">
            {snapshot.recommendedDailyLossLimit}%
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Max open positions</dt>
          <dd className="font-mono text-zinc-300">
            {snapshot.recommendedMaxOpenPositions}
          </dd>
        </div>
      </dl>

      <dl className="grid gap-2 text-[11px] sm:grid-cols-3">
        <div>
          <dt className="text-zinc-500">Win rate</dt>
          <dd className="font-mono text-zinc-300">
            {snapshot.inputs.winRate != null
              ? `${snapshot.inputs.winRate.toFixed(1)}%`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Losing streak</dt>
          <dd className="font-mono text-zinc-300">{snapshot.inputs.losingStreak}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Open exposure</dt>
          <dd className="font-mono text-zinc-300">
            ${snapshot.inputs.openExposureUsd.toFixed(0)}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Max drawdown</dt>
          <dd className="font-mono text-zinc-300">
            ${snapshot.inputs.maxDrawdownUsd} ({snapshot.inputs.maxDrawdownPct}%)
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Strategy health</dt>
          <dd className="font-mono text-zinc-300">
            {snapshot.inputs.strategyHealthStatus ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Incidents open</dt>
          <dd className="font-mono text-zinc-300">
            {snapshot.inputs.incidentOpenCount}
          </dd>
        </div>
      </dl>

      <ul className="space-y-1 text-xs text-zinc-400">
        {snapshot.reasons.map((r) => (
          <li key={r}>· {r}</li>
        ))}
      </ul>

      <p className="rounded border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-200/90">
        {snapshot.humanApprovalReason} Live trading remains locked — AI may
        recommend reducing risk only.
      </p>
    </div>
  );
}
