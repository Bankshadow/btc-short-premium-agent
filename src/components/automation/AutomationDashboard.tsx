"use client";

import { useCallback, useEffect, useState } from "react";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import {
  applyAutomationActions,
  loadAutomationSettings,
  loadLastAutomationRun,
  saveAutomationSettings,
  saveLastAutomationRun,
} from "@/lib/automation/apply-automation-client";
import type {
  AutomationAction,
  DeskAutomationResult,
} from "@/lib/automation/automation-types";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadPerpPositions } from "@/lib/multi-asset/perp-paper-store";
import { loadDeskSettings } from "@/lib/desk/desk-settings";

const MODULE_LABELS: Record<string, string> = {
  analyze: "Desk",
  assets: "Assets",
  council: "Council",
  mortem: "Mortem",
  simulation: "Sim",
  war_room: "War",
  capital: "Capital",
  validation: "Validation",
  frequency: "Freq",
  exchange: "Exchange",
  operator: "Operator",
};

function priorityClass(p: AutomationAction["priority"]): string {
  if (p === "HIGH") return "text-rose-300";
  if (p === "MEDIUM") return "text-amber-300";
  return "text-zinc-400";
}

export default function AutomationDashboard() {
  const [settings, setSettings] = useState(loadAutomationSettings);
  const [result, setResult] = useState<DeskAutomationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<string[]>([]);
  const [liveEnabled, setLiveEnabled] = useState(false);

  useEffect(() => {
    setResult(loadLastAutomationRun());
    fetch("/api/exchange/status")
      .then((r) => r.json())
      .then((d: { liveExecution?: { enabled: boolean } }) =>
        setLiveEnabled(d.liveExecution?.enabled ?? false),
      )
      .catch(() => undefined);
  }, []);

  const runAutomation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/desk/automation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: loadDecisionLog(),
          orders: loadPaperOrders(),
          perpPositions: loadPerpPositions(),
          riskProfile: loadDeskSettings().riskProfile,
          topic: "Manual automation run from /automation",
        }),
      });
      const data = (await res.json()) as DeskAutomationResult & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
      saveLastAutomationRun(data);
      setResult(data);
      const applyResult = applyAutomationActions(data.actions, settings);
      setApplied(applyResult.applied);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Automation failed");
    } finally {
      setLoading(false);
    }
  }, [settings]);

  const patchSettings = (patch: Partial<typeof settings>) => {
    const next = saveAutomationSettings(patch);
    setSettings(next);
  };

  const actions = result?.actions ?? [];

  return (
    <OpsShell
      badge="Desk Automation"
      title="AI Ops Orchestrator"
      subtitle="Runs Analyze · Assets · Council · Mortem · Sim · War · Capital · Validation · Gov · Exchange in one cycle — produces actionable items, not dead UI."
      accent="cyan"
      iconLetters="AI"
      activePath="/automation"
      actions={
        <button
          type="button"
          onClick={runAutomation}
          disabled={loading}
          className="rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-700 px-4 py-1.5 text-xs font-semibold text-zinc-950 disabled:opacity-50"
        >
          {loading ? "Running…" : "Run full cycle"}
        </button>
      }
    >
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <OpsKpi label="Modules" value="11" hint="per cycle" />
        <OpsKpi
          label="Last actions"
          value={String(actions.length)}
          hint={result?.timestamp ? new Date(result.timestamp).toLocaleTimeString() : "—"}
        />
        <OpsKpi
          label="Auto-applied"
          value={String(applied.length)}
          hint="this session"
        />
        <OpsKpi
          label="Live gate"
          value={liveEnabled ? "ON" : "OFF"}
          hint="LIVE_EXECUTION_ENABLED"
        />
      </section>

      <section className="desk-panel px-5 py-4">
        <p className="desk-section-title text-cyan-300/90">Automation settings</p>
        <div className="mt-3 flex flex-wrap gap-4 text-xs">
          <label className="flex items-center gap-2 text-zinc-300">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => patchSettings({ enabled: e.target.checked })}
              className="accent-cyan-500"
            />
            Auto-cycle on dashboard ({settings.intervalMinutes}m)
          </label>
          <label className="flex items-center gap-2 text-zinc-300">
            <input
              type="checkbox"
              checked={settings.autoApplyPaper}
              onChange={(e) => patchSettings({ autoApplyPaper: e.target.checked })}
              className="accent-cyan-500"
            />
            Auto-open paper perp from signals
          </label>
          <label className="flex items-center gap-2 text-zinc-300">
            <input
              type="checkbox"
              checked={settings.autoApplySafeMode}
              onChange={(e) => patchSettings({ autoApplySafeMode: e.target.checked })}
              className="accent-cyan-500"
            />
            Auto safe mode (war room)
          </label>
          <label className="text-zinc-500">
            Interval (min)
            <input
              type="number"
              min={5}
              max={120}
              value={settings.intervalMinutes}
              onChange={(e) =>
                patchSettings({ intervalMinutes: Number(e.target.value) })
              }
              className="ml-2 w-16 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-zinc-200"
            />
          </label>
        </div>
      </section>

      {error && (
        <div className="desk-panel border-rose-900/50 px-5 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {result && (
        <>
          <section className="desk-panel px-5 py-4">
            <p className="text-sm text-zinc-300">{result.summary}</p>
            <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-zinc-900/80 p-3 font-mono text-[11px] leading-relaxed text-zinc-400">
              {result.aiBrief}
            </pre>
          </section>

          <section className="desk-panel px-5 py-4">
            <p className="desk-section-title text-cyan-300/90">Module status</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {result.modulesRun.map((m) => {
                const ok = result.meta[m]?.ok;
                return (
                  <span
                    key={m}
                    className={`rounded-md px-2 py-1 text-[10px] font-medium ${
                      ok
                        ? "bg-emerald-950/50 text-emerald-300 ring-1 ring-emerald-900/50"
                        : "bg-rose-950/50 text-rose-300 ring-1 ring-rose-900/50"
                    }`}
                  >
                    {MODULE_LABELS[m] ?? m}
                    {result.meta[m]?.durationMs
                      ? ` ${result.meta[m]!.durationMs}ms`
                      : ""}
                  </span>
                );
              })}
            </div>
          </section>

          <section className="desk-panel overflow-hidden px-0 py-0">
            <div className="border-b border-zinc-800/80 px-5 py-3">
              <p className="desk-section-title text-cyan-300/90">Action queue</p>
              <p className="text-xs text-zinc-500">
                Auto-applicable actions run on client when settings allow
              </p>
            </div>
            {actions.length === 0 ? (
              <p className="px-5 py-4 text-xs text-zinc-600">No actions this cycle.</p>
            ) : (
              <ul className="divide-y divide-zinc-900/80">
                {actions.map((a) => (
                  <li key={a.id} className="px-5 py-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`font-semibold ${priorityClass(a.priority)}`}>
                        {a.priority}
                      </span>
                      <span className="text-zinc-500">{a.module}</span>
                      {a.autoApplicable && (
                        <span className="rounded bg-cyan-950/50 px-1.5 py-0.5 text-[10px] text-cyan-300">
                          AUTO
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-medium text-zinc-200">{a.title}</p>
                    <p className="text-zinc-500">{a.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </OpsShell>
  );
}
