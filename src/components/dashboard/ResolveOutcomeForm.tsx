"use client";

import { useState } from "react";
import type { OutcomeLabel } from "@/lib/journal/decision-log-types";
import { formatUsd } from "./utils";

interface ResolveOutcomeFormProps {
  entryBtcPrice: number;
  finalVerdict: string;
  onSubmit: (input: {
    btcPriceAfter: number;
    tradeWouldWin: boolean | null;
    notes: string;
    outcomeLabel: OutcomeLabel;
    manualPnlPct?: number | null;
  }) => void;
  onCancel: () => void;
}

const OUTCOME_OPTIONS: { id: OutcomeLabel; label: string; hint: string }[] = [
  { id: "WIN", label: "Win", hint: "Trade thesis worked" },
  { id: "LOSS", label: "Loss", hint: "Trade thesis failed" },
  { id: "BREAKEVEN", label: "Breakeven", hint: "Flat / scratch" },
  { id: "INVALIDATED", label: "Invalidated", hint: "Setup broke before settlement" },
  { id: "EXPIRED", label: "Expired", hint: "Option expired / time stopped" },
];

function mapOutcomeToWin(outcome: OutcomeLabel): boolean | null {
  if (outcome === "WIN") return true;
  if (outcome === "LOSS") return false;
  return null;
}

export default function ResolveOutcomeForm({
  entryBtcPrice,
  finalVerdict,
  onSubmit,
  onCancel,
}: ResolveOutcomeFormProps) {
  const [btcAfter, setBtcAfter] = useState("");
  const [outcomeLabel, setOutcomeLabel] = useState<OutcomeLabel>("WIN");
  const [manualPnl, setManualPnl] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const btcPriceAfter = Number(btcAfter.replace(/,/g, ""));
    if (!Number.isFinite(btcPriceAfter) || btcPriceAfter <= 0) return;

    const manualPnlPct =
      manualPnl.trim() === "" ? null : Number(manualPnl.replace(/,/g, ""));

    onSubmit({
      btcPriceAfter,
      tradeWouldWin: mapOutcomeToWin(outcomeLabel),
      notes,
      outcomeLabel,
      manualPnlPct:
        manualPnlPct != null && Number.isFinite(manualPnlPct) ? manualPnlPct : null,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50"
    >
      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Resolve outcome · entry BTC {formatUsd(entryBtcPrice)} · verdict {finalVerdict}
      </p>

      <fieldset className="mt-3">
        <legend className="text-xs text-zinc-500">Outcome</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {OUTCOME_OPTIONS.map((opt) => (
            <label
              key={opt.id}
              className={`flex cursor-pointer flex-col rounded border px-2 py-1.5 text-xs ${
                outcomeLabel === opt.id
                  ? "border-amber-600 bg-amber-950/30 text-amber-100"
                  : "border-zinc-300 dark:border-zinc-600"
              }`}
            >
              <span className="flex items-center gap-1.5 font-medium">
                <input
                  type="radio"
                  name="outcome-label"
                  checked={outcomeLabel === opt.id}
                  onChange={() => setOutcomeLabel(opt.id)}
                />
                {opt.label}
              </span>
              <span className="ml-5 text-[10px] text-zinc-500">{opt.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-3 block text-xs text-zinc-500">
        BTC price after settlement
        <input
          type="number"
          required
          min={1}
          step={1}
          value={btcAfter}
          onChange={(e) => setBtcAfter(e.target.value)}
          className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          placeholder="e.g. 96500"
        />
      </label>

      <label className="mt-3 block text-xs text-zinc-500">
        Manual PnL % (optional — overrides auto estimate)
        <input
          type="number"
          step={0.01}
          value={manualPnl}
          onChange={(e) => setManualPnl(e.target.value)}
          className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          placeholder="e.g. 1.25 or -0.8"
        />
      </label>

      <label className="mt-3 block text-xs text-zinc-500">
        Notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          placeholder="What happened at settlement…"
        />
      </label>

      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Save &amp; update learning
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-600"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
