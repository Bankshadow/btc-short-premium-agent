"use client";

import type { DeskScoreboard } from "@/lib/journal/agent-scoreboard";

interface AgentScoreboardPanelProps {
  scoreboard: DeskScoreboard;
}

export default function AgentScoreboardPanel({
  scoreboard,
}: AgentScoreboardPanelProps) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Agent Scoreboard
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Calibrated from resolved paper outcomes only — not live trading PnL.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Resolved" value={String(scoreboard.totalResolved)} />
        <Stat label="Pending" value={String(scoreboard.totalPending)} />
        <Stat
          label="Risk veto accuracy"
          value={
            scoreboard.riskVetoCount > 0
              ? `${scoreboard.riskVetoAccuracyPct}% (${scoreboard.correctVetoes}/${scoreboard.riskVetoCount})`
              : "—"
          }
        />
        <Stat
          label="Net paper PnL"
          value={`${scoreboard.netPaperPnlPct >= 0 ? "+" : ""}${scoreboard.netPaperPnlPct}%`}
        />
      </div>

      {scoreboard.agents.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">
          Resolve at least one decision to populate agent scores.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-3">Agent</th>
                <th className="py-2 pr-3">Calls</th>
                <th className="py-2 pr-3">✓ Trade</th>
                <th className="py-2 pr-3">✓ Skip</th>
                <th className="py-2 pr-3">False +</th>
                <th className="py-2">False −</th>
              </tr>
            </thead>
            <tbody>
              {scoreboard.agents.map((row) => (
                <tr
                  key={row.agentName}
                  className="border-b border-zinc-100 dark:border-zinc-800/80"
                >
                  <td className="py-2 pr-3 font-medium">{row.agentName}</td>
                  <td className="py-2 pr-3">{row.totalCalls}</td>
                  <td className="py-2 pr-3 text-emerald-600">
                    {row.correctTradeCalls}
                  </td>
                  <td className="py-2 pr-3 text-emerald-600">
                    {row.correctSkips}
                  </td>
                  <td className="py-2 pr-3 text-red-600">
                    {row.falsePositives}
                  </td>
                  <td className="py-2 text-amber-600">{row.falseNegatives}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900/50">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}
