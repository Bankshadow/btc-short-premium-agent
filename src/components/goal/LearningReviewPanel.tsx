"use client";

import { useCallback, useState } from "react";
import type { MissionFlowLearningItem } from "@/lib/mission-flow/types";

function usd(n: number): string {
  const sign = n < 0 ? "-" : "+";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

export default function LearningReviewPanel({
  items,
  pendingCount,
  autoLearnEnabled = false,
  onReviewed,
}: {
  items: MissionFlowLearningItem[];
  pendingCount: number;
  autoLearnEnabled?: boolean;
  onReviewed: () => void | Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = useCallback(
    async (learningRecordId: string, action: "mark-learned" | "pending-review") => {
      setBusyId(learningRecordId);
      setError(null);
      try {
        const res = await fetch(`/api/testnet-monitor/learning/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ learningRecordId }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error ?? "Learning action failed");
        await onReviewed();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Learning action failed");
      } finally {
        setBusyId(null);
      }
    },
    [onReviewed],
  );

  if (pendingCount === 0 && items.length === 0) return null;

  return (
    <section className="rounded-xl border border-violet-900/40 bg-violet-950/15 p-4">
      <p className="text-xs uppercase tracking-wide text-violet-300/80">
        Learning queue
      </p>
      <p className="mt-1 text-sm text-zinc-200">
        {autoLearnEnabled
          ? `${pendingCount} closed trade(s) queued — autopilot ingests lessons on the next cycle.`
          : `${pendingCount} closed trade(s) need review so AI can learn.`}
      </p>

      {items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li
              key={item.learningRecordId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800/70 px-3 py-2 text-xs"
            >
              <span className="text-zinc-300">
                <span className="font-mono text-zinc-100">{item.symbol}</span> ·{" "}
                {item.result} · {usd(item.netPnl)}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === item.learningRecordId}
                  onClick={() => void act(item.learningRecordId, "mark-learned")}
                  className="text-emerald-300 hover:underline disabled:opacity-50"
                >
                  Mark learned
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </section>
  );
}
