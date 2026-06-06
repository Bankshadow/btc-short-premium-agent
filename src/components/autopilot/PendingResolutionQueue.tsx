"use client";

import { useState } from "react";
import ResolveOutcomeForm from "@/components/dashboard/ResolveOutcomeForm";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { manualResolvePaperLifecycle } from "@/lib/paper-autopilot/run-engine";
import type { PaperLifecycleRecord } from "@/lib/paper-autopilot/types";

interface PendingResolutionQueueProps {
  pending: PaperLifecycleRecord[];
  onResolved: () => void;
}

export default function PendingResolutionQueue({
  pending,
  onResolved,
}: PendingResolutionQueueProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  if (pending.length === 0) {
    return (
      <p className="text-xs text-zinc-500">No trades pending resolution.</p>
    );
  }

  const logs = loadDecisionLog();
  const orders = loadPaperOrders();

  return (
    <ul className="space-y-3">
      {pending.map((record) => {
        const entry = logs.find((e) => e.id === record.decisionLogId);
        const order = orders.find((o) => o.id === record.tradeId);
        const isActive = activeId === record.lifecycleId;

        return (
          <li
            key={record.lifecycleId}
            className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <p className="font-medium text-amber-100">
                  {order?.instrument ?? "trade"} · {record.book}
                </p>
                <p className="text-zinc-500">
                  Closed {record.closedAt?.slice(0, 16) ?? "—"} · PnL{" "}
                  {record.realizedPnlPct != null
                    ? `${record.realizedPnlPct >= 0 ? "+" : ""}${record.realizedPnlPct}%`
                    : "—"}
                </p>
              </div>
              {!isActive && (
                <button
                  type="button"
                  onClick={() => setActiveId(record.lifecycleId)}
                  className="rounded bg-amber-800/60 px-2 py-1 text-xs text-amber-50 hover:bg-amber-700/60"
                >
                  Resolve now
                </button>
              )}
            </div>
            {isActive && entry && (
              <ResolveOutcomeForm
                entryBtcPrice={entry.btcPrice}
                finalVerdict={entry.finalVerdict}
                onCancel={() => setActiveId(null)}
                onSubmit={(input) => {
                  manualResolvePaperLifecycle(record.lifecycleId, input);
                  setActiveId(null);
                  onResolved();
                }}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
