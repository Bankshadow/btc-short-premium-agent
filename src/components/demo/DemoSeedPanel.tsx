"use client";

import { useState } from "react";
import {
  clearDemoDeskData,
  DEMO_SEED_LABEL,
  hasDemoSeedData,
  isDemoSeedAllowed,
  seedDemoDeskData,
} from "@/lib/demo/demo-seed";

type Props = {
  onChanged?: () => void;
};

export default function DemoSeedPanel({ onChanged }: Props) {
  const [hasDemo, setHasDemo] = useState(hasDemoSeedData());
  const [message, setMessage] = useState<string | null>(null);

  if (!isDemoSeedAllowed()) return null;

  const seed = () => {
    try {
      seedDemoDeskData(20);
      setHasDemo(true);
      setMessage(`Loaded 20 ${DEMO_SEED_LABEL} resolved outcomes.`);
      onChanged?.();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Seed failed");
    }
  };

  const reset = () => {
    clearDemoDeskData();
    setHasDemo(false);
    setMessage(`${DEMO_SEED_LABEL} data cleared.`);
    onChanged?.();
  };

  return (
    <section className="rounded-xl border border-amber-800/50 bg-amber-950/20 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-300/80">
        {DEMO_SEED_LABEL} learning pack
      </p>
      <p className="mt-1 text-xs text-amber-200/70">
        Seed 20 resolved paper outcomes for local demo. Marked {DEMO_SEED_LABEL} — excluded
        from live readiness, validation, and capital scaling metrics.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={seed}
          className="rounded-lg bg-amber-700/90 px-3 py-1.5 text-xs font-semibold text-zinc-950"
        >
          Seed demo data
        </button>
        {hasDemo && (
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-amber-800/60 px-3 py-1.5 text-xs text-amber-200"
          >
            Reset demo data
          </button>
        )}
      </div>
      {message && <p className="mt-2 text-[11px] text-amber-200/80">{message}</p>}
    </section>
  );
}
