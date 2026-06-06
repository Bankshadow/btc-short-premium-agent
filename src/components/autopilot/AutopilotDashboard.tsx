"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import {
  AUTOPILOT_MODE_LABELS,
  AUTOPILOT_SAFETY_NOTICE,
  resolveEffectiveMode,
} from "@/lib/autopilot/config";
import {
  loadAutopilotRunHistory,
  loadAutopilotSettings,
  loadLastAutopilotRun,
  saveAutopilotSettings,
} from "@/lib/autopilot/settings-store";
import type { AutopilotMode, AutopilotRunResult, AutopilotSettings } from "@/lib/autopilot/types";
import { useAutopilot } from "@/hooks/useAutopilot";
import { useDeskBackbone } from "@/hooks/useDeskBackbone";
import DataHealthPanel from "@/components/data-backbone/DataHealthPanel";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { usePermission } from "@/contexts/WorkspaceContext";
import PaperAutopilotPanel from "./PaperAutopilotPanel";

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

export default function AutopilotDashboard() {
  const canPaperAutopilot = usePermission("canEnablePaperAutopilot");
  const [settings, setSettings] = useState<AutopilotSettings>(loadAutopilotSettings());
  const [history, setHistory] = useState<AutopilotRunResult[]>([]);
  const autopilot = useAutopilot({ enabled: false });
  const backbone = useDeskBackbone();

  const refresh = useCallback(() => {
    setSettings(loadAutopilotSettings());
    const stored = loadAutopilotRunHistory();
    if (stored.length > 0) {
      setHistory(stored);
      return;
    }
    const last = loadLastAutopilotRun();
    if (last) setHistory([last]);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const patch = (p: Partial<AutopilotSettings>) => {
    const next = saveAutopilotSettings(p);
    setSettings(next);
  };

  const mode = resolveEffectiveMode(settings);

  return (
    <OpsShell
      badge="MVP 44 · Paper Autopilot"
      title="Autopilot Operating Loop"
      subtitle="Paper/shadow autopilot engine — auto-create, monitor, close, resolve. Live locked."
      accent="cyan"
      iconLetters="AP"
      activePath="/autopilot"
      nav={[
        { href: "/", label: "← Cockpit" },
        { href: "/actions", label: "Actions" },
        { href: "/command-center", label: "Command", primary: true },
      ]}
    >
      <p className="rounded-lg border border-cyan-900/40 bg-cyan-950/20 px-4 py-2 text-xs text-cyan-200/80">
        {AUTOPILOT_SAFETY_NOTICE}
      </p>

      <DataHealthPanel health={backbone.health} />

      <div className="grid gap-3 sm:grid-cols-4">
        <OpsKpi label="Mode" value={AUTOPILOT_MODE_LABELS[mode]} hint="Effective mode" />
        <OpsKpi
          label="Status"
          value={autopilot.lastRun?.status ?? "IDLE"}
          hint={autopilot.lastRun?.deskStatus ?? "—"}
        />
        <OpsKpi
          label="Interval"
          value={`${settings.runIntervalMinutes}m`}
          hint="Run frequency"
        />
        <OpsKpi
          label="Live autopilot"
          value="LOCKED"
          hint="Human approval required"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={autopilot.running}
          onClick={() => void autopilot.runCycle()}
          className="rounded-lg bg-cyan-800/70 px-3 py-1.5 text-xs text-zinc-100 hover:bg-cyan-700/70 disabled:opacity-50"
        >
          Run autopilot now
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Autopilot mode">
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={settings.autopilotEnabled}
              onChange={(e) => patch({ autopilotEnabled: e.target.checked })}
            />
            Autopilot enabled
          </label>
          <select
            className="mt-3 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
            value={settings.mode}
            onChange={(e) =>
              patch({ mode: e.target.value as AutopilotMode })
            }
          >
            {(Object.keys(AUTOPILOT_MODE_LABELS) as AutopilotMode[]).map((m) => (
              <option key={m} value={m}>
                {AUTOPILOT_MODE_LABELS[m]}
              </option>
            ))}
          </select>
          <label className="mt-3 flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={settings.paperAutopilotEnabled}
              disabled={!canPaperAutopilot}
              onChange={(e) => patch({ paperAutopilotEnabled: e.target.checked })}
            />
            Paper autopilot (auto paper recommendations)
          </label>
          {!canPaperAutopilot && (
            <p className="text-[10px] text-zinc-500">Requires TRADER, ADMIN, or OWNER role.</p>
          )}
          <label className="mt-2 flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={settings.shadowModeEnabled}
              disabled={!canPaperAutopilot}
              onChange={(e) => patch({ shadowModeEnabled: e.target.checked })}
            />
            Shadow mode
          </label>
          <label className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={settings.autoResolveEnabled}
              onChange={(e) => patch({ autoResolveEnabled: e.target.checked })}
            />
            Auto-resolve outcomes (off by default)
          </label>
        </Panel>

        <Panel title="Safety locks">
          <ul className="space-y-1 text-xs text-zinc-400">
            <li className="text-rose-300">✓ Live autopilot locked</li>
            <li>✓ Human approval required for live</li>
            <li>✓ Kill switch respected</li>
            <li>✓ Risk veto respected</li>
            <li>✓ Data trust respected</li>
          </ul>
        </Panel>

        <Panel title="Paper autopilot settings">
          <label className="block text-xs text-zinc-400">
            Run interval (minutes)
            <input
              type="number"
              min={5}
              max={120}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
              value={settings.runIntervalMinutes}
              onChange={(e) =>
                patch({ runIntervalMinutes: Number(e.target.value) || 15 })
              }
            />
          </label>
          <label className="mt-3 block text-xs text-zinc-400">
            Max paper trades / day
            <input
              type="number"
              min={0}
              max={20}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
              value={settings.maxPaperTradesPerDay}
              onChange={(e) =>
                patch({ maxPaperTradesPerDay: Number(e.target.value) || 3 })
              }
            />
          </label>
          <label className="mt-3 block text-xs text-zinc-400">
            Max shadow trades / day
            <input
              type="number"
              min={0}
              max={20}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
              value={settings.maxShadowTradesPerDay}
              onChange={(e) =>
                patch({ maxShadowTradesPerDay: Number(e.target.value) || 5 })
              }
            />
          </label>
        </Panel>

        <Panel title="Last run summary">
          {autopilot.lastRun ? (
            <div className="space-y-1 text-xs text-zinc-400">
              <p>
                {autopilot.lastRun.status} · {autopilot.lastRun.finalVerdict} ·{" "}
                {autopilot.lastRun.deskStatus}
              </p>
              <p>{autopilot.lastRun.briefing}</p>
              <p className="text-zinc-500">
                Modules:{" "}
                {autopilot.lastRun.modulesRun.map((m) => m.moduleId).join(", ")}
              </p>
              <p>
                Journal: {loadDecisionLog().length} logs · {loadPaperOrders().length}{" "}
                paper orders
              </p>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">No autopilot run yet.</p>
          )}
        </Panel>
      </div>

      {history.length > 0 && (
        <Panel title="Run history">
          <ul className="space-y-2 text-xs text-zinc-500">
            {history.map((h) => (
              <li key={h.runId}>
                {h.completedAt ?? h.startedAt} — {h.status} — {h.recommendedAction}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {autopilot.error && (
        <p className="rounded border border-rose-900/50 px-3 py-2 text-xs text-rose-300">
          {autopilot.error}
        </p>
      )}

      <PaperAutopilotPanel />

      <Link href="/" className="text-xs text-cyan-400 hover:underline">
        Return to command cockpit →
      </Link>
    </OpsShell>
  );
}
