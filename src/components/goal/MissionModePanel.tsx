"use client";

import type { MissionFlowSnapshot } from "@/lib/mission-flow/types";

export default function MissionModePanel({
  snapshot: m,
}: {
  snapshot: MissionFlowSnapshot;
}) {
  const mode = m.automation.autoExecuteEnabled
    ? "Fully automatic"
    : m.automation.enabled && !m.automation.paused
      ? "Semi-automatic"
      : "Paused / off";

  const modeDetail = m.automation.autoExecuteEnabled
    ? "Analyze → trade → monitor → learn every 15 min without manual clicks."
    : m.automation.enabled && !m.automation.paused
      ? "Cycles run on schedule; testnet trades still need double-confirm unless auto-execute env is on."
      : "Enable and resume autopilot on the Dashboard or below.";

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Mission mode
      </h2>
      <p className="mt-2 font-mono text-lg text-zinc-100">{mode}</p>
      <p className="mt-1 text-xs text-zinc-400">{modeDetail}</p>

      <dl className="mt-4 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">Auto-execute testnet</dt>
          <dd className={m.automation.autoExecuteEnabled ? "text-emerald-300" : "text-amber-300"}>
            {m.automation.autoExecuteEnabled ? "On (server env)" : "Off — set BINANCE_TESTNET_AUTOEXECUTE_ENABLED=true"}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Auto-learn closed trades</dt>
          <dd className={m.automation.autoLearnEnabled ? "text-emerald-300" : "text-amber-300"}>
            {m.automation.autoLearnEnabled ? "On — ingests on each cycle" : "Manual Mark learned"}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Position monitor</dt>
          <dd>SL -2% · TP +3% · max hold 24h · verdict flip</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Cron schedule</dt>
          <dd>
            {m.automation.enabled && !m.automation.paused
              ? `Every ${m.automation.intervalMinutes} min`
              : "Disabled"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
