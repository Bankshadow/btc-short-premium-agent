"use client";

import { useState } from "react";
import { formatUsd } from "./utils";

interface ResolveOutcomeFormProps {
  entryBtcPrice: number;
  finalVerdict: string;
  onSubmit: (input: {
    btcPriceAfter: number;
    tradeWouldWin: boolean | null;
    notes: string;
  }) => void;
  onCancel: () => void;
}

export default function ResolveOutcomeForm({
  entryBtcPrice,
  finalVerdict,
  onSubmit,
  onCancel,
}: ResolveOutcomeFormProps) {
  const [btcAfter, setBtcAfter] = useState("");
  const [outcome, setOutcome] = useState<"win" | "loss" | "na">("na");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const btcPriceAfter = Number(btcAfter.replace(/,/g, ""));
    if (!Number.isFinite(btcPriceAfter) || btcPriceAfter <= 0) return;

    let tradeWouldWin: boolean | null = null;
    if (outcome === "win") tradeWouldWin = true;
    if (outcome === "loss") tradeWouldWin = false;

    onSubmit({ btcPriceAfter, tradeWouldWin, notes });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50"
    >
      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Paper resolve · entry BTC {formatUsd(entryBtcPrice)} · verdict{" "}
        {finalVerdict}
      </p>
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
      <fieldset className="mt-3">
        <legend className="text-xs text-zinc-500">
          Would the proposed trade have won?
        </legend>
        <div className="mt-1 flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="paper-outcome"
              checked={outcome === "win"}
              onChange={() => setOutcome("win")}
            />
            Win
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="paper-outcome"
              checked={outcome === "loss"}
              onChange={() => setOutcome("loss")}
            />
            Loss
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="paper-outcome"
              checked={outcome === "na"}
              onChange={() => setOutcome("na")}
            />
            N/A (skip / no trade)
          </label>
        </div>
      </fieldset>
      <label className="mt-3 block text-xs text-zinc-500">
        Notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          placeholder="Settlement context, what you observed…"
        />
      </label>
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Save &amp; reflect
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
