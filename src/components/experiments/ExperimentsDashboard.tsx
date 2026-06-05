"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadDiscoveredProposals } from "@/lib/rule-discovery";
import { loadEvaluationResults, runLearningReport } from "@/lib/self-learning";
import { loadCouncilSessions } from "@/lib/council/council-session-store";
import {
  appendExperiment,
  appendExperimentAudit,
  applyPromotionToRegistry,
  buildExperimentLabReport,
  experimentFromUserHypothesis,
  loadExperimentAudit,
  loadExperiments,
  saveExperiments,
  updateExperiment,
  type ExperimentLabReport,
  type StrategyExperiment,
} from "@/lib/strategy-experiments";
import { EXPERIMENT_SAFETY_NOTICE } from "@/lib/strategy-experiments/types";

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

function statusClass(status: string): string {
  const map: Record<string, string> = {
    draft: "text-zinc-400",
    running: "text-cyan-300",
    active: "text-cyan-300",
    completed: "text-teal-300",
    failed: "text-rose-400",
    promotion_pending: "text-amber-300",
    promoted: "text-emerald-300",
    archived: "text-zinc-500",
  };
  return map[status] ?? "text-zinc-400";
}

export default function ExperimentsDashboard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ExperimentLabReport | null>(null);
  const [hypothesis, setHypothesis] = useState("");
  const [expected, setExpected] = useState("");

  const refresh = useCallback(() => {
    const experiments = loadExperiments();
    const auditLog = loadExperimentAudit();
    setReport(buildExperimentLabReport(experiments, auditLog));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runExperiment = async (experiment: StrategyExperiment) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/strategy-experiments/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experiment,
          entries: loadDecisionLog(),
          orders: loadPaperOrders(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? res.statusText);
      updateExperiment(data.experiment.experimentId, data.experiment);
      appendExperimentAudit({
        id: `exp-audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        experimentId: data.experiment.experimentId,
        action: data.experiment.result?.passedSuccess ? "COMPLETED" : "FAILED",
        detail: data.experiment.result?.summary ?? "Run finished",
      });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(false);
    }
  };

  const promote = async (
    experiment: StrategyExperiment,
    action: "approve" | "reject" | "apply",
  ) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/strategy-experiments/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experiment, proposalId: experiment.promotionProposal?.proposalId, action }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? res.statusText);
      updateExperiment(data.experiment.experimentId, data.experiment);
      appendExperimentAudit(data.auditEntry);
      if (data.registryPatch && action === "apply") {
        applyPromotionToRegistry(data.registryPatch);
      }
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Promotion failed");
    } finally {
      setBusy(false);
    }
  };

  const createUserExperiment = () => {
    if (!hypothesis.trim()) return;
    const exp = experimentFromUserHypothesis({
      summary: hypothesis.trim(),
      expectedOutcome: expected.trim() || "Improved paper edge in target regime",
      mode: "historical_replay",
    });
    appendExperiment(exp);
    appendExperimentAudit({
      id: `exp-audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      experimentId: exp.experimentId,
      action: "CREATED",
      detail: "User hypothesis experiment",
    });
    setHypothesis("");
    setExpected("");
    refresh();
  };

  const importFromSources = async () => {
    setBusy(true);
    setError(null);
    const created: StrategyExperiment[] = [];

    try {
      const council = loadCouncilSessions()[0];
      if (council?.proposals[0]) {
        const res = await fetch("/api/strategy-experiments/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ councilProposal: council.proposals[0] }),
        });
        const data = await res.json();
        if (data.ok) created.push(data.experiment);
      }

      const rule = loadDiscoveredProposals().find((p) => p.lifecycle === "proposed");
      if (rule) {
        const res = await fetch("/api/strategy-experiments/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ruleDiscovery: rule }),
        });
        const data = await res.json();
        if (data.ok) created.push(data.experiment);
      }

      const learning = runLearningReport(loadDecisionLog(), loadEvaluationResults());
      const rec = learning.improvementRecommendations[0];
      if (rec) {
        const res = await fetch("/api/strategy-experiments/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selfLearning: rec }),
        });
        const data = await res.json();
        if (data.ok) created.push(data.experiment);
      }

      if (created.length === 0) {
        setError("No importable sources — run council, rule discovery, or learning first.");
      } else {
        saveExperiments([...created, ...loadExperiments()]);
        for (const exp of created) {
          appendExperimentAudit({
            id: `exp-audit-${Date.now()}-${exp.experimentId}`,
            timestamp: new Date().toISOString(),
            experimentId: exp.experimentId,
            action: "CREATED",
            detail: `Imported from ${exp.source}`,
          });
        }
        refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <OpsShell
      badge="MVP 31 · Isolated sandbox"
      title="Strategy Experiment Lab"
      subtitle="Test AI-generated strategy variants in replay/shadow mode — production unchanged."
      accent="violet"
      actions={
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void importFromSources()}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
          >
            Import sources
          </button>
        </div>
      }
    >
      <p className="mb-4 rounded-lg border border-violet-900/40 bg-violet-950/20 px-3 py-2 text-sm text-violet-200/90">
        {EXPERIMENT_SAFETY_NOTICE}{" "}
        <Link href="/strategies" className="underline">
          Strategy registry
        </Link>{" "}
        updates only after promotion approval.
      </p>

      {error ? <p className="mb-4 text-sm text-rose-300">{error}</p> : null}

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={hypothesis}
          onChange={(e) => setHypothesis(e.target.value)}
          placeholder="User hypothesis…"
          className="min-w-[200px] flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200"
        />
        <input
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
          placeholder="Expected outcome…"
          className="min-w-[160px] flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200"
        />
        <button
          type="button"
          onClick={createUserExperiment}
          className="rounded-lg bg-violet-700 px-3 py-1 text-sm text-zinc-50 hover:bg-violet-600"
        >
          Create experiment
        </button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OpsKpi label="Active" value={String(report?.activeExperiments.length ?? "—")} />
        <OpsKpi label="Results" value={String(report?.completedResults.length ?? "—")} />
        <OpsKpi label="Shadow trades" value={String(report?.shadowTrades.length ?? "—")} />
        <OpsKpi label="Promotions" value={String(report?.promotionCandidates.length ?? "—")} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Active Experiments">
          {report?.activeExperiments.length ? (
            <ul className="space-y-3 text-sm">
              {report.activeExperiments.map((exp) => (
                <li
                  key={exp.experimentId}
                  className="rounded-lg border border-violet-900/30 bg-zinc-900/40 p-3"
                >
                  <p className="font-medium text-violet-200">{exp.label}</p>
                  <p className="text-xs text-zinc-500">
                    {exp.source} · {exp.mode} ·{" "}
                    <span className={statusClass(exp.status)}>{exp.status}</span>
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">{exp.hypothesis.summary}</p>
                  <p className="mt-1 text-[10px] text-zinc-600">
                    Paper positions: {exp.openPaperPositions ? "enabled" : "shadow only"}
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runExperiment(exp)}
                    className="mt-2 rounded border border-violet-700 px-2 py-1 text-xs text-violet-300"
                  >
                    Run replay
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">Create or import an experiment.</p>
          )}
        </Panel>

        <Panel title="Experiment Results">
          {report?.completedResults.length ? (
            <ul className="space-y-2 text-sm text-zinc-300">
              {report.completedResults.map((exp) => (
                <li key={exp.experimentId} className="border-b border-zinc-800/60 pb-2">
                  {exp.label}
                  <br />
                  <span className="text-xs text-zinc-500">
                    {exp.result?.summary} · win {exp.result?.winRate}% · net{" "}
                    {exp.result?.netPnlPct}%
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No completed runs yet.</p>
          )}
        </Panel>

        <Panel title="Shadow Trades">
          {report?.shadowTrades.length ? (
            <ul className="max-h-72 space-y-2 overflow-y-auto text-sm text-zinc-300">
              {report.shadowTrades.map((s) => (
                <li key={s.id} className="border-b border-zinc-800/60 pb-2">
                  <span className="font-mono text-xs text-zinc-500">
                    {s.decisionLogId.slice(0, 10)}
                  </span>{" "}
                  committee {s.committeeVerdict} → shadow {s.shadowVerdict}
                  {s.aligned ? (
                    <span className="text-emerald-400"> ✓</span>
                  ) : (
                    <span className="text-amber-400"> ≠</span>
                  )}
                  <br />
                  <span className="text-xs text-zinc-500">
                    hypo {s.hypotheticalPnlPct ?? "—"}% · actual {s.actualPnlPct ?? "—"}%
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">Shadow log empty — run an experiment.</p>
          )}
        </Panel>

        <Panel title="Promotion Candidates">
          {report?.promotionCandidates.length ? (
            <ul className="space-y-3 text-sm">
              {report.promotionCandidates.map((p) => {
                const exp = loadExperiments().find((e) => e.experimentId === p.experimentId);
                if (!exp) return null;
                return (
                  <li
                    key={p.proposalId}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"
                  >
                    <p className="text-zinc-100">{p.targetStrategy}</p>
                    <p className="text-xs text-zinc-400">
                      → {p.proposedRegistryStatus} · win {p.supportingStats.winRate}% ·{" "}
                      {p.status}
                    </p>
                    <div className="mt-2 flex gap-2">
                      {p.status === "PENDING" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void promote(exp, "approve")}
                            className="rounded border border-emerald-700 px-2 py-1 text-xs text-emerald-300"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => void promote(exp, "reject")}
                            className="rounded border border-rose-800 px-2 py-1 text-xs text-rose-300"
                          >
                            Reject
                          </button>
                        </>
                      ) : p.status === "APPROVED" ? (
                        <button
                          type="button"
                          onClick={() => void promote(exp, "apply")}
                          className="rounded border border-violet-700 px-2 py-1 text-xs text-violet-300"
                        >
                          Apply to registry
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No promotion candidates.</p>
          )}
        </Panel>

        <Panel title="Failed Hypotheses">
          {report?.failedHypotheses.length ? (
            <ul className="space-y-2 text-sm text-rose-300/90">
              {report.failedHypotheses.map((exp) => (
                <li key={exp.experimentId}>
                  {exp.label} — {exp.result?.summary ?? "Failed"}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No failed hypotheses logged.</p>
          )}
        </Panel>

        <Panel title="Experiment Audit Log">
          {report?.auditLog.length ? (
            <ul className="max-h-64 space-y-2 overflow-y-auto text-sm text-zinc-400">
              {report.auditLog.map((a) => (
                <li key={a.id}>
                  <span className="text-violet-300">{a.action}</span> · {a.detail}
                  <br />
                  <span className="text-xs text-zinc-600">
                    {new Date(a.timestamp).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No audit entries.</p>
          )}
        </Panel>
      </div>
    </OpsShell>
  );
}
