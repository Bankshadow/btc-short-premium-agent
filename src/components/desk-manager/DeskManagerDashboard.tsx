"use client";

import { useCallback, useEffect, useState } from "react";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import {
  countPendingActions,
  loadActionQueue,
  mergeActionQueue,
} from "@/lib/autonomous-desk-manager/action-queue-store";
import {
  loadDeskManagerSettings,
  saveDeskManagerSettings,
} from "@/lib/autonomous-desk-manager/settings";
import {
  loadLastDeskManagerRun,
  persistDeskManagerResult,
} from "@/lib/autonomous-desk-manager/apply-desk-manager-client";
import type {
  DeskManagerAction,
  DeskManagerCycleType,
  DeskManagerRunResult,
} from "@/lib/autonomous-desk-manager/types";
import { DESK_MANAGER_SAFETY_NOTICE } from "@/lib/autonomous-desk-manager/types";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadPerpPositions } from "@/lib/multi-asset/perp-paper-store";
import { loadDeskSettings } from "@/lib/desk/desk-settings";
import { loadGovernanceState } from "@/lib/governance/governance-state";
import { loadEvaluationResults } from "@/lib/self-learning";
import { loadDiscoveredProposals } from "@/lib/rule-discovery/proposal-store";
import { loadAdaptationProposals } from "@/lib/strategy-adaptation/proposal-store";
import { loadExperiments } from "@/lib/strategy-experiments/experiment-store";
import { loadIncidents } from "@/lib/governance/incidents-store";
import { loadCouncilSessions } from "@/lib/council/council-session-store";

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function priorityClass(p: DeskManagerAction["priority"]): string {
  if (p === "HIGH") return "text-rose-300";
  if (p === "MEDIUM") return "text-amber-300";
  return "text-zinc-400";
}

function escalationClass(level: string): string {
  if (level === "CRITICAL") return "text-rose-400";
  if (level === "ELEVATED") return "text-orange-300";
  if (level === "WATCH") return "text-amber-300";
  return "text-emerald-400";
}

export default function DeskManagerDashboard() {
  const [settings, setSettings] = useState(loadDeskManagerSettings);
  const [result, setResult] = useState<DeskManagerRunResult | null>(null);
  const [queue, setQueue] = useState<DeskManagerAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshLocal = useCallback(() => {
    setResult(loadLastDeskManagerRun());
    setQueue(loadActionQueue());
  }, []);

  useEffect(() => {
    refreshLocal();
  }, [refreshLocal]);

  const runManager = useCallback(
    async (cycleType: DeskManagerCycleType) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/desk-manager/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cycleType,
            entries: loadDecisionLog(),
            orders: loadPaperOrders(),
            perpPositions: loadPerpPositions(),
            riskProfile: loadDeskSettings().riskProfile,
            governanceState: loadGovernanceState(),
            storedEvaluations: loadEvaluationResults(),
            storedRuleProposals: loadDiscoveredProposals(),
            storedAdaptationProposals: loadAdaptationProposals(),
            experiments: loadExperiments(),
            incidents: loadIncidents(),
            councilSessions: loadCouncilSessions(),
            lastManagerRunAt: loadLastDeskManagerRun()?.timestamp ?? settings.lastOperationalRunAt,
          }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          result?: DeskManagerRunResult;
          error?: string;
        };
        if (!res.ok || !data.ok || !data.result) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        persistDeskManagerResult(data.result);
        setResult(data.result);
        setQueue(loadActionQueue());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Run failed");
      } finally {
        setLoading(false);
      }
    },
    [settings.lastOperationalRunAt],
  );

  const resolveAction = useCallback(
    async (actionId: string, status: "RESOLVED" | "DISMISSED") => {
      const res = await fetch("/api/desk-manager/action/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId,
          status,
          queue: loadActionQueue(),
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        queue?: DeskManagerAction[];
        error?: string;
      };
      if (!res.ok || !data.ok || !data.queue) {
        setError(data.error ?? "Resolve failed");
        return;
      }
      mergeActionQueue(data.queue);
      setQueue(loadActionQueue());
    },
    [],
  );

  const patchSettings = (patch: Partial<typeof settings>) => {
    const next = saveDeskManagerSettings(patch);
    setSettings(next);
  };

  const pending = queue.filter((a) => a.status === "PENDING");
  const strategyActions = pending.filter(
    (a) => a.type === "REVIEW_STRATEGY" || a.type === "PAUSE_STRATEGY",
  );
  const riskActions = pending.filter((a) => a.type === "ESCALATE_RISK");
  const experimentActions = pending.filter(
    (a) =>
      a.type === "RUN_EXPERIMENT" || a.type === "CLOSE_EXPERIMENT",
  );

  return (
    <OpsShell
      badge="Desk Manager"
      title="Autonomous Desk Manager"
      subtitle="Coordinates analyze, learning, rule discovery, experiments, and operator briefings — non-executing, human approval required for all material actions."
      accent="cyan"
      iconLetters="DM"
      activePath="/desk-manager"
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void runManager("operational")}
            className="rounded-lg border border-cyan-800 bg-cyan-950/40 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-900/40 disabled:opacity-50"
          >
            {loading ? "Running…" : "Run operational cycle"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void runManager("daily_learning")}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          >
            Daily learning
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void runManager("weekly_strategy_review")}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          >
            Weekly review
          </button>
        </div>
      }
    >
      <p className="mb-4 text-xs text-zinc-500">{DESK_MANAGER_SAFETY_NOTICE}</p>
      {error && (
        <p className="mb-4 rounded border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OpsKpi
          label="Pending actions"
          value={String(countPendingActions())}
          hint="Requires human approval"
        />
        <OpsKpi
          label="Last cycle"
          value={result?.cycleType ?? "—"}
          hint={result?.timestamp ? new Date(result.timestamp).toLocaleString() : "Not run yet"}
        />
        <OpsKpi
          label="Risk level"
          value={result?.riskSummary.escalationLevel ?? "—"}
          hint={result?.riskSummary.notes[0]}
        />
        <OpsKpi
          label="New evaluations"
          value={String(result?.learningSummary.newEvaluations ?? 0)}
          hint={result?.learningSummary.leaderboardSummary}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-3 text-xs text-zinc-400">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => patchSettings({ enabled: e.target.checked })}
          />
          Manager enabled
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.chainWithDeskAutomation}
            onChange={(e) =>
              patchSettings({ chainWithDeskAutomation: e.target.checked })
            }
          />
          Chain with 15m desk automation
        </label>
        <span>Interval {settings.operationalIntervalMinutes}m · Daily UTC {settings.dailyLearningHourUtc}:00 · Weekly day {settings.weeklyStrategyReviewDay}</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Today's desk briefing">
          {result?.briefing ? (
            <div className="space-y-3 text-sm text-zinc-300">
              <p className="text-base font-semibold text-cyan-200">
                {result.briefing.headline}
              </p>
              <p className="font-mono text-xs text-zinc-500">
                {result.briefing.marketSnapshot}
              </p>
              <ul className="space-y-1 text-xs">
                {result.briefing.keyFindings.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
              <div>
                <p className="text-[10px] uppercase text-zinc-500">Top actions</p>
                <ul className="mt-1 space-y-1 text-xs text-amber-200/90">
                  {result.briefing.topActions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">Run a cycle to generate briefing.</p>
          )}
        </Panel>

        <Panel title="Action queue">
          {pending.length === 0 ? (
            <p className="text-xs text-zinc-500">No pending actions.</p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto text-xs">
              {pending.map((action) => (
                <li
                  key={action.actionId}
                  className="rounded border border-zinc-800 bg-zinc-900/50 p-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`font-semibold ${priorityClass(action.priority)}`}>
                      {action.type}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => void resolveAction(action.actionId, "RESOLVED")}
                        className="rounded border border-emerald-900 px-2 py-0.5 text-[10px] text-emerald-300"
                      >
                        Resolve
                      </button>
                      <button
                        type="button"
                        onClick={() => void resolveAction(action.actionId, "DISMISSED")}
                        className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-zinc-400">{action.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Learning updates">
          {result?.learningSummary ? (
            <ul className="space-y-1 text-xs text-zinc-400">
              <li>Total evaluations: {result.learningSummary.totalEvaluations}</li>
              <li>New this cycle: {result.learningSummary.newEvaluations}</li>
              <li>Top agent: {result.learningSummary.topAgent ?? "n/a"}</li>
              <li>Weakest: {result.learningSummary.weakestAgent ?? "n/a"}</li>
              <li>Recommendations: {result.learningSummary.newRecommendations}</li>
              {result.learningSummary.agentUpdates.map((u) => (
                <li key={u} className="text-teal-300/90">
                  {u}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">No learning data yet.</p>
          )}
        </Panel>

        <Panel title="Strategy proposals">
          {strategyActions.length === 0 ? (
            <p className="text-xs text-zinc-500">No pending strategy actions.</p>
          ) : (
            <ul className="space-y-2 text-xs text-zinc-400">
              {strategyActions.map((a) => (
                <li key={a.actionId}>
                  <span className="text-indigo-300">{a.type}</span> — {a.reason}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Risk escalations">
          {result?.riskSummary ? (
            <div className="space-y-2 text-xs">
              <p className={`font-semibold ${escalationClass(result.riskSummary.escalationLevel)}`}>
                {result.riskSummary.escalationLevel}
              </p>
              <ul className="space-y-1 text-zinc-400">
                {result.riskSummary.notes.map((n) => (
                  <li key={n}>• {n}</li>
                ))}
              </ul>
              {riskActions.map((a) => (
                <p key={a.actionId} className="text-rose-300/90">
                  {a.reason}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">No risk summary.</p>
          )}
        </Panel>

        <Panel title="Experiment updates">
          {result?.briefing.experimentNotes?.length ? (
            <ul className="space-y-1 text-xs text-zinc-400">
              {result.briefing.experimentNotes.map((n) => (
                <li key={n}>• {n}</li>
              ))}
              {experimentActions.map((a) => (
                <li key={a.actionId} className="text-violet-300/90">
                  {a.type}: {a.reason}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">No experiment updates.</p>
          )}
        </Panel>
      </div>

      <Panel title="Automation timeline">
        {result?.timeline?.length ? (
          <ul className="mt-2 space-y-1 font-mono text-[11px] text-zinc-500">
            {result.timeline.map((step) => (
              <li key={`${step.step}-${step.detail}`}>
                <span
                  className={
                    step.status === "ok"
                      ? "text-emerald-500"
                      : step.status === "error"
                        ? "text-rose-400"
                        : "text-zinc-600"
                  }
                >
                  [{step.status}]
                </span>{" "}
                {step.step} · {step.durationMs}ms — {step.detail}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-zinc-500">Timeline empty until first run.</p>
        )}
      </Panel>
    </OpsShell>
  );
}
