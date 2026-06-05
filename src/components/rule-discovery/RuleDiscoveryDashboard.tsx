"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadPerpPositions } from "@/lib/multi-asset/perp-paper-store";
import { loadDeskSettings } from "@/lib/desk/desk-settings";
import { loadEvaluationResults } from "@/lib/self-learning";
import { buildStrategyRegistry } from "@/lib/strategy-registry/build-strategy-registry";
import {
  approveDiscoveredRule,
  rejectDiscoveredRule,
  pauseDiscoveredRule,
  retireDiscoveredRule,
  editDiscoveredProposal,
  loadDiscoveredProposals,
  mergeDiscoveredProposals,
  type AutoDiscoveredRuleProposal,
  type RuleDiscoveryReport,
} from "@/lib/rule-discovery";
import { RULE_DISCOVERY_SAFETY_NOTICE } from "@/lib/rule-discovery/types";

function ruleTypeBadge(type: string): string {
  const map: Record<string, string> = {
    BLOCK: "bg-rose-900/50 text-rose-200",
    CAUTION: "bg-amber-900/50 text-amber-200",
    SIZE_REDUCE: "bg-orange-900/50 text-orange-200",
    SIZE_INCREASE: "bg-cyan-900/50 text-cyan-200",
    ALLOW_PAPER: "bg-emerald-900/50 text-emerald-200",
    REVIEW: "bg-indigo-900/50 text-indigo-200",
  };
  return map[type] ?? "bg-zinc-800 text-zinc-300";
}

function lifecycleBadge(status: string): string {
  const map: Record<string, string> = {
    discovered: "text-zinc-400",
    proposed: "text-amber-300",
    approved: "text-teal-300",
    active: "text-emerald-300",
    paused: "text-orange-300",
    retired: "text-zinc-500",
    rejected: "text-rose-400",
  };
  return map[status] ?? "text-zinc-400";
}

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

export default function RuleDiscoveryDashboard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<RuleDiscoveryReport | null>(null);
  const [editNotes, setEditNotes] = useState<Record<string, string>>({});

  const buildPayload = useCallback(() => {
    const entries = loadDecisionLog();
    const orders = loadPaperOrders();
    const riskProfile = loadDeskSettings().riskProfile;
    const registry = buildStrategyRegistry({
      entries,
      orders,
      riskProfile,
    });
    return {
      entries,
      orders,
      perpPositions: loadPerpPositions(),
      riskProfile,
      evaluations: loadEvaluationResults(),
      registryStrategies: registry.strategies,
      storedProposals: loadDiscoveredProposals(),
    };
  }, []);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rule-discovery/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? res.statusText);
      setReport(data.report as RuleDiscoveryReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report failed");
    } finally {
      setBusy(false);
    }
  }, [buildPayload]);

  const runDiscover = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rule-discovery/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? res.statusText);
      const merged = mergeDiscoveredProposals(data.report.proposals ?? []);
      setReport({ ...data.report, proposals: merged });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Discovery failed");
    } finally {
      setBusy(false);
    }
  }, [buildPayload]);

  const handleApprove = (proposal: AutoDiscoveredRuleProposal) => {
    const edited = editNotes[proposal.ruleId]?.trim();
    const result = approveDiscoveredRule({
      proposalId: proposal.ruleId,
      editedCondition: edited || undefined,
      reviewerNote: "Approved on rule discovery dashboard",
      activate: true,
      linkStrategyId: proposal.suggestedScope.strategyId,
    });
    if (!result) {
      setError("Could not approve proposal");
      return;
    }
    void refresh();
  };

  const handleReject = (proposal: AutoDiscoveredRuleProposal) => {
    rejectDiscoveredRule({
      proposalId: proposal.ruleId,
      reviewerNote: "Rejected on rule discovery dashboard",
    });
    void refresh();
  };

  const handlePause = (proposal: AutoDiscoveredRuleProposal) => {
    pauseDiscoveredRule(proposal.ruleId);
    void refresh();
  };

  const handleRetire = (proposal: AutoDiscoveredRuleProposal) => {
    retireDiscoveredRule(proposal.ruleId);
    void refresh();
  };

  const handleSaveEdit = (proposal: AutoDiscoveredRuleProposal) => {
    const edited = editNotes[proposal.ruleId]?.trim();
    if (!edited) return;
    editDiscoveredProposal(proposal.ruleId, { editedCondition: edited });
    void refresh();
  };

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectedImpact = report?.approvalQueue[0];

  return (
    <OpsShell
      badge="MVP 30 · No auto-approval"
      title="Auto Rule Discovery"
      subtitle="Mine winning/losing patterns, simulate impact, propose draft rules for human approval."
      accent="indigo"
      actions={
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void refresh()}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runDiscover()}
            className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-indigo-600 disabled:opacity-50"
          >
            {busy ? "Discovering…" : "Run discovery"}
          </button>
        </div>
      }
    >
      <p className="mb-4 rounded-lg border border-indigo-900/40 bg-indigo-950/20 px-3 py-2 text-sm text-indigo-200/90">
        {RULE_DISCOVERY_SAFETY_NOTICE}{" "}
        <Link href="/simulation" className="underline">
          Rule impact simulation
        </Link>{" "}
        ·{" "}
        <Link href="/strategies" className="underline">
          Strategy registry
        </Link>
      </p>

      {error ? <p className="mb-4 text-sm text-rose-300">{error}</p> : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OpsKpi label="Patterns" value={String(report?.patterns.length ?? "—")} />
        <OpsKpi
          label="Approval queue"
          value={String(report?.approvalQueue.length ?? "—")}
        />
        <OpsKpi label="Active rules" value={String(report?.activeRules.length ?? "—")} />
        <OpsKpi label="Rejected" value={String(report?.rejected.length ?? "—")} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Discovered Patterns">
          {report?.patterns.length ? (
            <ul className="max-h-80 space-y-2 overflow-y-auto text-sm text-zinc-300">
              {report.patterns.map((p) => (
                <li key={p.patternId} className="border-b border-zinc-800/60 pb-2">
                  <span className="text-indigo-300">{p.category}</span> · conf{" "}
                  {p.confidence}%
                  <br />
                  {p.condition}
                  <br />
                  <span className="text-xs text-zinc-500">
                    n={p.sampleSize} · win {p.winRate}% · avg {p.avgPnlPct}%
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">Run discovery after resolving outcomes.</p>
          )}
        </Panel>

        <Panel title="Proposed Rules">
          {report?.proposed.length ? (
            <ul className="space-y-3 text-sm">
              {report.proposed.map((p) => (
                <li
                  key={p.ruleId}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${ruleTypeBadge(p.ruleType)}`}
                    >
                      {p.ruleType}
                    </span>
                    <span className={`text-xs uppercase ${lifecycleBadge(p.lifecycle)}`}>
                      {p.lifecycle}
                    </span>
                    {p.requiresStrongApproval ? (
                      <span className="text-[10px] text-rose-300">strong approval</span>
                    ) : null}
                  </div>
                  <p className="mt-2 font-medium text-zinc-100">{p.title}</p>
                  <p className="mt-1 text-xs text-zinc-400">{p.condition}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Conf {p.confidence}% · support {p.supportingTrades.length} trades
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No proposals yet.</p>
          )}
        </Panel>

        <Panel title="Backtest Impact">
          {selectedImpact ? (
            <div className="space-y-2 text-sm text-zinc-300">
              <p className="font-medium text-zinc-100">{selectedImpact.title}</p>
              <p>Avoided losses: {selectedImpact.estimatedImpact.expectedAvoidedLosses}%</p>
              <p>Missed profits: {selectedImpact.estimatedImpact.missedProfits}%</p>
              <p>
                Trade frequency change:{" "}
                {selectedImpact.estimatedImpact.tradeFrequencyChangePct}%
              </p>
              <p>Net impact: {selectedImpact.estimatedImpact.netImpactPct}%</p>
              <p className="text-xs text-zinc-500">
                {selectedImpact.estimatedImpact.explanation}
              </p>
              <p className="text-xs text-amber-300/80">
                Sim: {selectedImpact.estimatedImpact.recommendation}
              </p>
            </div>
          ) : report?.approvalQueue.length ? (
            <p className="text-sm text-zinc-500">Select a queued proposal below.</p>
          ) : (
            <p className="text-sm text-zinc-500">No impact data yet.</p>
          )}
        </Panel>

        <Panel title="Approval Queue">
          {report?.approvalQueue.length ? (
            <ul className="space-y-3 text-sm">
              {report.approvalQueue.map((p) => (
                <li
                  key={p.ruleId}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"
                >
                  <p className="font-medium text-zinc-100">{p.title}</p>
                  <textarea
                    className="mt-2 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
                    rows={2}
                    placeholder="Edit condition before approve…"
                    value={editNotes[p.ruleId] ?? p.editedCondition ?? p.condition}
                    onChange={(e) =>
                      setEditNotes((prev) => ({
                        ...prev,
                        [p.ruleId]: e.target.value,
                      }))
                    }
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(p)}
                      className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-300"
                    >
                      Save edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(p)}
                      className="rounded border border-emerald-700 px-2 py-1 text-xs text-emerald-300"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(p)}
                      className="rounded border border-rose-800 px-2 py-1 text-xs text-rose-300"
                    >
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">Queue empty — run discovery.</p>
          )}
        </Panel>

        <Panel title="Rejected Rules">
          {report?.rejected.length ? (
            <ul className="max-h-64 space-y-2 overflow-y-auto text-sm text-zinc-400">
              {report.rejected.map((p) => (
                <li key={p.ruleId}>
                  {p.title} — {p.reviewerNote ?? "rejected"}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No rejected rules.</p>
          )}
        </Panel>

        <Panel title="Rule Performance After Approval">
          {report?.performanceAfterApproval.length ? (
            <ul className="space-y-2 text-sm text-zinc-300">
              {report.performanceAfterApproval.map((p) => {
                const full = report.activeRules.find((r) => r.ruleId === p.ruleId);
                return (
                  <li
                    key={p.ruleId}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-zinc-100">{p.title}</span>
                      <span className={`text-xs uppercase ${lifecycleBadge(p.lifecycle)}`}>
                        {p.lifecycle}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      Est. net impact {p.estimatedNetImpactPct}% · support{" "}
                      {p.supportingTrades} · draft {p.linkedDraftRuleId ?? "—"}
                    </p>
                    {full ? (
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handlePause(full)}
                          className="rounded border border-amber-800 px-2 py-1 text-xs text-amber-300"
                        >
                          Pause
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRetire(full)}
                          className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-400"
                        >
                          Retire
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">Approve rules to track performance.</p>
          )}
        </Panel>
      </div>
    </OpsShell>
  );
}
