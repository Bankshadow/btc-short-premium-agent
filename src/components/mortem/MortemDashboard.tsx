"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import OpsShell from "@/components/ops/OpsShell";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadDraftRules } from "@/lib/journal/draft-rules";
import { buildRegretMetrics, riskVetoAccuracy } from "@/lib/regret/regret-tracker";
import { preMortemBlocksTicket } from "@/lib/mortem/apply-mortem-layer";

export default function MortemDashboard() {
  const [tick, setTick] = useState(0);

  const entries = useMemo(() => {
    void tick;
    return loadDecisionLog();
  }, [tick]);

  const regret = useMemo(() => buildRegretMetrics(entries), [entries]);
  const vetoStats = useMemo(() => riskVetoAccuracy(entries), [entries]);

  const pendingPreMortems = entries.filter(
    (e) =>
      e.outcomeStatus === "PENDING" &&
      e.finalVerdict === "TRADE" &&
      e.preMortem != null,
  );

  const recentAutopsies = entries
    .filter((e) => e.autopsy != null)
    .slice(0, 12);

  const falseTable = entries
    .filter(
      (e) =>
        e.outcomeStatus === "RESOLVED" &&
        (e.falseTradeFlag || e.falseSkipFlag),
    )
    .slice(0, 20);

  const lessonRows = entries
    .filter((e) => (e.lessonTags?.length ?? 0) > 0)
    .slice(0, 15);

  const autopsyDrafts = loadDraftRules().filter((r) =>
    r.title.toLowerCase().includes("autopsy"),
  );

  return (
    <OpsShell
      badge="Learning layer · Analysis only"
      title="Pre-Mortem, Loss Autopsy & Regret"
      subtitle="Reason about failure before TRADE and learn from losses and missed setups. Draft rules require human approval — no live execution."
      accent="emerald"
      iconLetters="LM"
      activePath="/mortem"
      nav={[
        { href: "/", label: "← Trading desk" },
        { href: "/validation", label: "Validation" },
        { href: "/governance", label: "Governance" },
      ]}
      actions={
        <button
          type="button"
          onClick={() => setTick((t) => t + 1)}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          Refresh
        </button>
      }
    >
      <section className="desk-panel px-5 py-4">
        <h2 className="desk-section-title">Regret tracker</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Correct TRADE", value: regret.correctTrade },
            { label: "False TRADE", value: regret.falseTrade },
            { label: "Correct SKIP", value: regret.correctSkip },
            { label: "False SKIP", value: regret.falseSkip },
            { label: "Avoided loss R", value: regret.avoidedLossR, mono: true },
            { label: "Missed opp. R", value: regret.missedOpportunityR, mono: true },
          ].map((k) => (
            <div
              key={k.label}
              className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2"
            >
              <p className="text-[10px] text-zinc-600">{k.label}</p>
              <p
                className={`text-lg font-semibold text-zinc-100 ${k.mono ? "font-mono" : ""}`}
              >
                {k.value}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-2 font-mono text-xs text-zinc-500">
          Regret score {regret.regretScore}/100 (lower is better)
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="desk-panel px-5 py-4">
          <h2 className="desk-section-title">Pending pre-mortems</h2>
          {pendingPreMortems.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-600">
              No pending TRADE sessions with pre-mortem. Run analyze on the desk.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {pendingPreMortems.map((e) => (
                <li
                  key={e.id}
                  className="rounded border border-zinc-800 px-3 py-2 text-[11px]"
                >
                  <span className="font-mono text-zinc-500">
                    {e.timestamp.slice(0, 19)}
                  </span>
                  <span
                    className={`ml-2 font-semibold ${
                      preMortemBlocksTicket(e.preMortem)
                        ? "text-rose-400"
                        : "text-amber-300"
                    }`}
                  >
                    {e.preMortem?.preMortemVerdict}
                  </span>
                  <p className="mt-1 text-zinc-400">{e.preMortem?.topFailureReason}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="desk-panel px-5 py-4">
          <h2 className="desk-section-title">Risk veto accuracy</h2>
          <p className="mt-2 text-sm text-zinc-300">
            Saved loss: <span className="text-emerald-400">{vetoStats.saved}</span>
            {" · "}
            Too conservative:{" "}
            <span className="text-amber-300">{vetoStats.tooConservative}</span>
            {" · "}
            Total veto sessions: {vetoStats.total}
          </p>
        </section>
      </div>

      <section className="desk-panel px-5 py-4">
        <h2 className="desk-section-title">Recent loss autopsies</h2>
        {recentAutopsies.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-600">
            Resolve outcomes marked as losses to generate autopsies.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {recentAutopsies.map((e) => (
              <article
                key={e.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-4 py-3"
              >
                <p className="font-mono text-[10px] text-zinc-600">{e.id.slice(0, 12)}</p>
                <p className="mt-1 text-sm font-medium text-rose-300/90">
                  {e.autopsy?.lossType.replace(/_/g, " ")}
                </p>
                <p className="mt-1 text-xs text-zinc-400">{e.autopsy?.rootCause}</p>
                <p className="mt-2 text-[11px] text-zinc-500">
                  {e.autopsy?.preventionSuggestion}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="desk-panel px-5 py-4">
        <h2 className="desk-section-title">False TRADE / False SKIP</h2>
        <div className="mt-3 overflow-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="text-zinc-600">
              <tr>
                <th className="px-2 py-1">Time</th>
                <th className="px-2 py-1">Verdict</th>
                <th className="px-2 py-1">Class</th>
                <th className="px-2 py-1">Flags</th>
                <th className="px-2 py-1">R</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 text-zinc-400">
              {falseTable.map((e) => (
                <tr key={e.id}>
                  <td className="px-2 py-1.5 font-mono">{e.timestamp.slice(0, 10)}</td>
                  <td className="px-2 py-1.5">{e.finalVerdict}</td>
                  <td className="px-2 py-1.5">{e.regretClassification ?? "—"}</td>
                  <td className="px-2 py-1.5">
                    {e.falseTradeFlag ? "FALSE_TRADE " : ""}
                    {e.falseSkipFlag ? "FALSE_SKIP" : ""}
                  </td>
                  <td className="px-2 py-1.5 font-mono">
                    {e.falseTradeFlag
                      ? `-${Math.abs(e.paperPnl ?? 0)}`
                      : `+${e.missedOpportunityR ?? 0}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="desk-panel px-5 py-4">
          <h2 className="desk-section-title">Lessons learned</h2>
          <ul className="mt-2 space-y-2 text-[11px] text-zinc-400">
            {lessonRows.map((e) => (
              <li key={e.id} className="rounded border border-zinc-800 px-3 py-2">
                <span className="text-zinc-500">{e.regretClassification}</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(e.lessonTags ?? []).map((t) => (
                    <span
                      key={t}
                      className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="desk-panel px-5 py-4">
          <h2 className="desk-section-title">Draft rule suggestions (autopsy)</h2>
          <p className="mt-1 text-[10px] text-zinc-600">
            Human approval required — does not affect live committee.
          </p>
          <ul className="mt-3 space-y-2 text-[11px] text-zinc-400">
            {autopsyDrafts.length === 0 ? (
              <li className="text-zinc-600">No autopsy draft rules yet.</li>
            ) : (
              autopsyDrafts.map((r) => (
                <li key={r.id} className="rounded border border-zinc-800 px-3 py-2">
                  <p className="text-zinc-300">{r.title}</p>
                  <p className="mt-1">{r.description}</p>
                  <Link
                    href="/"
                    className="mt-1 inline-block text-[10px] text-amber-400 hover:underline"
                  >
                    Review on desk →
                  </Link>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </OpsShell>
  );
}
