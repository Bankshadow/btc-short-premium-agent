"use client";

import type { DecisionLogEntry } from "@/lib/journal/decision-log";
import type { ResolveOutcomeInput } from "@/lib/journal/decision-log-types";
import { getTradeLifecycleForEntry } from "@/lib/journal/trade-lifecycle";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import { DEMO_SEED_LABEL } from "@/lib/demo/demo-seed";
import { recBadgeClass } from "./trading-desk/agent-display";
import ResolveOutcomeForm from "./ResolveOutcomeForm";
import { formatTimestamp, formatUsd } from "./utils";
import { useState } from "react";

interface DecisionLogPanelProps {
  entries: DecisionLogEntry[];
  orders?: PaperOrder[];
  onResolve: (id: string, input: ResolveOutcomeInput) => void;
}

function ReflectionBlock({
  reflection,
}: {
  reflection: NonNullable<DecisionLogEntry["reflection"]>;
}) {
  return (
    <div className="mt-3 rounded-lg border border-zinc-100 bg-zinc-50/80 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900/40">
      <p className="font-semibold text-zinc-700 dark:text-zinc-300">
        Reflection (outcome-grounded)
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <p className="font-medium text-emerald-700 dark:text-emerald-400">Correct</p>
          <ul className="list-disc pl-4 text-zinc-600 dark:text-zinc-400">
            {reflection.whatWasCorrect.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-medium text-red-700 dark:text-red-400">Wrong</p>
          <ul className="list-disc pl-4 text-zinc-600 dark:text-zinc-400">
            {reflection.whatWasWrong.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      </div>
      {reflection.tooAggressiveAgents.length > 0 && (
        <p className="mt-2 text-amber-700 dark:text-amber-300">
          Too aggressive: {reflection.tooAggressiveAgents.join(" · ")}
        </p>
      )}
      {reflection.helpfulRiskRules.length > 0 && (
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Risk rules that helped: {reflection.helpfulRiskRules.join(" · ")}
        </p>
      )}
      <p className="mt-2 rounded border border-dashed border-zinc-300 px-2 py-1 dark:border-zinc-600">
        <span className="font-medium">Draft rule proposal: </span>
        {reflection.suggestedDraftRule}
      </p>
    </div>
  );
}

export default function DecisionLogPanel({
  entries,
  orders = [],
  onResolve,
}: DecisionLogPanelProps) {
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          MVP 3 · Persistent log (localStorage)
        </p>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Decision Log
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Every Analyze Now run is stored. Resolve outcomes for paper PnL and
          reflection — no real orders.
        </p>
      </header>

      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">
          No learning data yet. Run the first desk cycle to start building trade memory.
        </p>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => {
            const lifecycle = getTradeLifecycleForEntry(entry.id, orders);
            return (
            <article
              key={entry.id}
              className="rounded-lg border border-zinc-100 p-4 dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-zinc-500">
                    {formatTimestamp(entry.timestamp)}
                    {entry.isDemoData && (
                      <span className="ml-2 rounded bg-amber-900/50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-200">
                        {DEMO_SEED_LABEL}
                      </span>
                    )}
                  </p>
                  <p className="font-mono text-sm font-semibold">
                    BTC {formatUsd(entry.btcPrice)}
                    {entry.resolution && (
                      <span className="text-zinc-500">
                        {" → "}
                        {formatUsd(entry.resolution.btcPriceAfter)}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                    {entry.marketRegime}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 font-bold ${recBadgeClass(entry.finalVerdict)}`}
                  >
                    {entry.finalVerdict}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 ${
                      entry.outcomeStatus === "RESOLVED"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "border border-zinc-300 dark:border-zinc-600"
                    }`}
                  >
                    {entry.outcomeStatus}
                  </span>
                  {entry.paperPnl != null && (
                    <span
                      className={
                        entry.paperPnl >= 0
                          ? "text-emerald-600"
                          : "text-red-600"
                      }
                    >
                      Paper {entry.paperPnl >= 0 ? "+" : ""}
                      {entry.paperPnl}%
                    </span>
                  )}
                  {entry.riskVeto && (
                    <span className="font-bold text-red-600">VETO</span>
                  )}
                  <span className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                    {lifecycle.label}
                  </span>
                  {entry.resolution?.outcomeLabel && (
                    <span className="rounded bg-indigo-100 px-2 py-0.5 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                      {entry.resolution.outcomeLabel}
                    </span>
                  )}
                </div>
              </div>

              <ul className="mt-2 list-disc pl-4 text-xs text-zinc-600 dark:text-zinc-400">
                {entry.topReasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-zinc-500">{entry.actionPlan}</p>

              {entry.reflection && (
                <ReflectionBlock reflection={entry.reflection} />
              )}

              {entry.outcomeStatus === "PENDING" && resolvingId !== entry.id && (
                <button
                  type="button"
                  onClick={() => setResolvingId(entry.id)}
                  className="mt-3 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-900"
                >
                  Resolve Outcome
                </button>
              )}

              {resolvingId === entry.id && (
                <ResolveOutcomeForm
                  entryBtcPrice={entry.btcPrice}
                  finalVerdict={entry.finalVerdict}
                  onSubmit={(input) => {
                    onResolve(entry.id, input);
                    setResolvingId(null);
                  }}
                  onCancel={() => setResolvingId(null)}
                />
              )}
            </article>
          );
          })}
        </div>
      )}
    </section>
  );
}
