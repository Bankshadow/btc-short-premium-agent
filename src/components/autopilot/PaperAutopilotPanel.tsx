"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PAPER_AUTOPILOT_MODE_LABELS,
  PAPER_AUTOPILOT_SAFETY_NOTICE,
} from "@/lib/paper-autopilot/config";
import {
  loadPaperLifecycleRecords,
} from "@/lib/paper-autopilot/lifecycle-store";
import {
  getPendingResolutionQueue,
} from "@/lib/paper-autopilot/resolve-queue";
import {
  loadPaperAutopilotSettings,
  savePaperAutopilotSettings,
} from "@/lib/paper-autopilot/settings-store";
import type {
  PaperAutopilotMode,
  PaperAutopilotRunResult,
  PaperAutopilotSettings,
} from "@/lib/paper-autopilot/types";
import { runPaperAutopilot } from "@/lib/paper-autopilot/run-engine";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import PaperLifecycleTimeline from "./PaperLifecycleTimeline";
import PendingResolutionQueue from "./PendingResolutionQueue";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function PaperAutopilotPanel() {
  const [settings, setSettings] = useState<PaperAutopilotSettings>(
    loadPaperAutopilotSettings(),
  );
  const [lastRun, setLastRun] = useState<PaperAutopilotRunResult | null>(null);
  const [lifecycles, setLifecycles] = useState(loadPaperLifecycleRecords());
  const [pending, setPending] = useState(getPendingResolutionQueue());

  const refresh = useCallback(() => {
    setSettings(loadPaperAutopilotSettings());
    setLifecycles(loadPaperLifecycleRecords());
    setPending(getPendingResolutionQueue());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const patch = (p: Partial<PaperAutopilotSettings>) => {
    const next = savePaperAutopilotSettings(p);
    setSettings(next);
  };

  const runNow = () => {
    const orders = loadPaperOrders();
    const open = orders.find((o) => o.status === "OPEN");
    const btc =
      open?.lastMarkBtcPrice ??
      open?.entryBtcPrice ??
      orders[0]?.entryBtcPrice ??
      0;
    if (btc <= 0) return;
    const result = runPaperAutopilot({ btcPrice: btc, settings });
    setLastRun(result);
    refresh();
  };

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-violet-900/40 bg-violet-950/20 px-4 py-2 text-xs text-violet-200/90">
        {PAPER_AUTOPILOT_SAFETY_NOTICE}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Paper autopilot engine">
          <select
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
            value={settings.mode}
            onChange={(e) =>
              patch({ mode: e.target.value as PaperAutopilotMode })
            }
          >
            {(Object.keys(PAPER_AUTOPILOT_MODE_LABELS) as PaperAutopilotMode[]).map(
              (m) => (
                <option key={m} value={m}>
                  {PAPER_AUTOPILOT_MODE_LABELS[m]}
                </option>
              ),
            )}
          </select>

          <label className="mt-3 flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={settings.autoCloseOnRecommendation}
              onChange={(e) =>
                patch({ autoCloseOnRecommendation: e.target.checked })
              }
            />
            Auto-close on SL/TP / verdict flip
          </label>
          <label className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={settings.autoResolveEnabled}
              onChange={(e) => patch({ autoResolveEnabled: e.target.checked })}
            />
            Auto-resolve (demo/local only — off by default)
          </label>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="block text-xs text-zinc-500">
              Shadow min confidence
              <input
                type="number"
                min={50}
                max={95}
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
                value={settings.shadowMinConfidence}
                onChange={(e) =>
                  patch({ shadowMinConfidence: Number(e.target.value) || 65 })
                }
              />
            </label>
            <label className="block text-xs text-zinc-500">
              Stop loss %
              <input
                type="number"
                step={0.1}
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
                value={settings.stopLossPct}
                onChange={(e) =>
                  patch({ stopLossPct: Number(e.target.value) || -2 })
                }
              />
            </label>
          </div>

          <button
            type="button"
            onClick={runNow}
            disabled={settings.mode === "OFF"}
            className="mt-3 rounded-lg bg-violet-800/70 px-3 py-1.5 text-xs text-zinc-100 hover:bg-violet-700/70 disabled:opacity-50"
          >
            Run paper monitor now
          </button>

          {lastRun && (
            <p className="mt-3 text-xs text-zinc-500">
              Last run: monitored {lastRun.monitored} · created {lastRun.created.length}{" "}
              · close rec {lastRun.closeRecommended} · closed {lastRun.closed} · pending{" "}
              {lastRun.pendingResolution}
            </p>
          )}
        </Panel>

        <Panel title="Pending resolution queue">
          <PendingResolutionQueue pending={pending} onResolved={refresh} />
        </Panel>
      </div>

      <Panel title="Paper lifecycle timeline">
        <PaperLifecycleTimeline records={lifecycles} />
      </Panel>
    </div>
  );
}
