"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import { OPS_ACCENT } from "@/components/ops/ops-theme";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadDraftRules } from "@/lib/journal/draft-rules";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadPinnedNotes } from "@/lib/memory/pinned-notes";
import { loadIncidents } from "@/lib/governance/incidents-store";
import { loadCouncilSessions } from "@/lib/council/council-session-store";
import { loadAdaptationProposals } from "@/lib/strategy-adaptation/proposal-store";
import { loadDeskSettings } from "@/lib/desk/desk-settings";
import { buildStrategyRegistry } from "@/lib/strategy-registry/build-strategy-registry";
import {
  saveMemoryGraphSnapshot,
  type MemoryGraphSnapshot,
  type RelevantMemoryResult,
} from "@/lib/memory-graph";
import { MEMORY_GRAPH_SAFETY_NOTICE } from "@/lib/memory-graph/build-graph";

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

export default function MemoryGraphDashboard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<MemoryGraphSnapshot | null>(null);
  const [relevant, setRelevant] = useState<RelevantMemoryResult | null>(null);
  const [regimeFilter, setRegimeFilter] = useState("");
  const [strategyFilter, setStrategyFilter] = useState("");

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    const entries = loadDecisionLog();
    const orders = loadPaperOrders();
    const riskProfile = loadDeskSettings().riskProfile;
    const registry = buildStrategyRegistry({ entries, orders, riskProfile });

    try {
      const res = await fetch("/api/memory-graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries,
          orders,
          draftRules: loadDraftRules(),
          pinnedNotes: loadPinnedNotes(),
          incidents: loadIncidents(),
          councilSessions: loadCouncilSessions(),
          adaptationProposals: loadAdaptationProposals(),
          registryStrategies: registry.strategies,
          context: {
            marketRegime: regimeFilter || entries[0]?.marketRegime,
            strategy: strategyFilter || undefined,
            riskProfile,
            limit: 8,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? res.statusText);
      }
      setSnapshot(data.snapshot);
      setRelevant(data.relevant);
      saveMemoryGraphSnapshot(data.snapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Memory graph refresh failed");
    } finally {
      setBusy(false);
    }
  }, [regimeFilter, strategyFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const strategyRegimeMap = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.edges.filter(
      (e) =>
        e.relation === "performs_well_in" || e.relation === "performs_poorly_in",
    );
  }, [snapshot]);

  const agentWeaknesses = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.edges.filter((e) => e.relation === "agent_wrong_under");
  }, [snapshot]);

  const riskPatterns = useMemo(() => {
    if (!snapshot) return { events: [], edges: [] };
    return {
      events: snapshot.nodes.filter((n) => n.type === "risk_event"),
      edges: snapshot.edges.filter(
        (e) =>
          e.relation === "condition_increased_drawdown" ||
          e.relation === "incident_caused_by",
      ),
    };
  }, [snapshot]);

  const recentUpdates = useMemo(() => {
    if (!snapshot) return [];
    return [...snapshot.nodes]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 12);
  }, [snapshot]);

  const accent = OPS_ACCENT.violet;

  return (
    <OpsShell
      badge="MVP 28 · Advisory memory"
      title="Agent Memory Graph"
      subtitle="Structured lessons from decisions, outcomes, reflections, and governance — advisory only."
      accent="violet"
      actions={
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${accent.btn} disabled:opacity-50`}
        >
          {busy ? "Building…" : "Rebuild graph"}
        </button>
      }
    >
      <p className="mb-4 rounded-lg border border-violet-900/40 bg-violet-950/20 px-3 py-2 text-sm text-violet-200/90">
        {MEMORY_GRAPH_SAFETY_NOTICE}
      </p>

      {error ? (
        <p className="mb-4 text-sm text-rose-300">{error}</p>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OpsKpi label="Nodes" value={String(snapshot?.nodeCount ?? "—")} />
        <OpsKpi label="Edges" value={String(snapshot?.edgeCount ?? "—")} />
        <OpsKpi
          label="Lessons retrieved"
          value={String(relevant?.lessons.length ?? "—")}
        />
        <OpsKpi
          label="Generated"
          value={
            snapshot?.generatedAt
              ? new Date(snapshot.generatedAt).toLocaleString()
              : "—"
          }
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          Regime context
          <input
            value={regimeFilter}
            onChange={(e) => setRegimeFilter(e.target.value)}
            placeholder="e.g. Risk-on trend"
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          Strategy context
          <input
            value={strategyFilter}
            onChange={(e) => setStrategyFilter(e.target.value)}
            placeholder="e.g. short_call_weekly"
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
          />
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Memory Graph Overview">
          {snapshot ? (
            <ul className="space-y-2 text-sm text-zinc-300">
              {Object.entries(
                snapshot.nodes.reduce<Record<string, number>>((acc, n) => {
                  acc[n.type] = (acc[n.type] ?? 0) + 1;
                  return acc;
                }, {}),
              ).map(([type, count]) => (
                <li key={type}>
                  <span className="text-violet-300">{type}</span>: {count}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No graph yet.</p>
          )}
        </Panel>

        <Panel title="Top Lessons">
          {relevant?.lessons.length ? (
            <ul className="space-y-3 text-sm">
              {relevant.lessons.map((lesson, i) => (
                <li
                  key={`${lesson.bullet}-${i}`}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
                >
                  <p className="text-zinc-200">{lesson.bullet}</p>
                  <p className="mt-1 text-xs text-violet-300/80">
                    Why used: {lesson.whyUsed}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Score {lesson.score.toFixed(1)} · nodes {lesson.nodeIds.join(", ")}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">
              Resolve more outcomes to populate lessons.
            </p>
          )}
        </Panel>

        <Panel title="Strategy–Regime Map">
          {strategyRegimeMap.length ? (
            <ul className="max-h-64 space-y-2 overflow-y-auto text-sm text-zinc-300">
              {strategyRegimeMap.slice(0, 20).map((e) => (
                <li key={e.id} className="border-b border-zinc-800/60 pb-2">
                  <span
                    className={
                      e.relation === "performs_well_in"
                        ? "text-emerald-400"
                        : "text-rose-400"
                    }
                  >
                    {e.relation.replace(/_/g, " ")}
                  </span>
                  : {e.evidence}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No strategy–regime edges yet.</p>
          )}
        </Panel>

        <Panel title="Agent Weaknesses">
          {agentWeaknesses.length ? (
            <ul className="max-h-64 space-y-2 overflow-y-auto text-sm text-zinc-300">
              {agentWeaknesses.slice(0, 15).map((e) => (
                <li key={e.id}>{e.evidence}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No agent weakness edges logged.</p>
          )}
        </Panel>

        <Panel title="Risk Patterns">
          {riskPatterns.events.length || riskPatterns.edges.length ? (
            <div className="space-y-3 text-sm text-zinc-300">
              {riskPatterns.events.map((n) => (
                <p key={n.id} className="text-rose-300/90">
                  {n.label}: {n.summary}
                </p>
              ))}
              {riskPatterns.edges.map((e) => (
                <p key={e.id} className="text-zinc-400">
                  {e.relation.replace(/_/g, " ")} — {e.evidence}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No risk pattern nodes yet.</p>
          )}
        </Panel>

        <Panel title="Recent Memory Updates">
          {recentUpdates.length ? (
            <ul className="max-h-64 space-y-2 overflow-y-auto text-sm text-zinc-300">
              {recentUpdates.map((n) => (
                <li key={n.id} className="border-b border-zinc-800/60 pb-2">
                  <span className="text-violet-300">{n.type}</span> · {n.label}
                  <br />
                  <span className="text-xs text-zinc-500">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No nodes yet.</p>
          )}
        </Panel>
      </div>

      {snapshot?.topLessons.length ? (
        <Panel title="Graph top lessons (global)">
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-400">
            {snapshot.topLessons.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </OpsShell>
  );
}
