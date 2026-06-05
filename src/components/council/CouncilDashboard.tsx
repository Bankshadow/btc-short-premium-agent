"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadPerpPositions } from "@/lib/multi-asset/perp-paper-store";
import { loadDeskSettings } from "@/lib/desk/desk-settings";
import { loadCapitalSettings } from "@/lib/capital/capital-settings";
import { buildCapitalReport } from "@/lib/capital/build-capital-report";
import { runCouncilSession } from "@/lib/council/run-council-session";
import {
  loadCouncilSessions,
  saveCouncilSession,
  updateProposalStatus,
} from "@/lib/council/council-session-store";
import type {
  CouncilProposalStatus,
  CouncilSessionResult,
} from "@/lib/council/types";
import { COUNCIL_GUARDRAILS } from "@/lib/council/types";
import { loadAdaptationProposals } from "@/lib/strategy-adaptation/proposal-store";
import { loadIncidents } from "@/lib/governance/incidents-store";
import { buildStrategyRegistry } from "@/lib/strategy-registry/build-strategy-registry";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import { OPS_ACCENT } from "@/components/ops/ops-theme";
import {
  agentInitials,
  COUNCIL_CAPABILITIES,
  committeeDecisionStyles,
  proposalStatusStyles,
  stanceStyles,
} from "./council-ui";

function AllocationBar({
  reserve,
  core,
  growth,
  experimental,
}: {
  reserve: number;
  core: number;
  growth: number;
  experimental: number;
}) {
  const segments = [
    { pct: reserve, label: "Reserve", className: "bg-zinc-600" },
    { pct: core, label: "Core", className: "bg-violet-500/90" },
    { pct: growth, label: "Growth", className: "bg-amber-500/90" },
    { pct: experimental, label: "Exp", className: "bg-rose-500/70" },
  ];
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-zinc-900 ring-1 ring-zinc-800">
        {segments.map((s) =>
          s.pct > 0 ? (
            <div
              key={s.label}
              className={`${s.className} transition-all`}
              style={{ width: `${s.pct}%` }}
              title={`${s.label} ${s.pct}%`}
            />
          ) : null,
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-zinc-500">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-sm ${s.className}`} />
            {s.label} {s.pct}%
          </span>
        ))}
      </div>
    </div>
  );
}

export default function CouncilDashboard() {
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<CouncilSessionResult | null>(null);
  const [history, setHistory] = useState<CouncilSessionResult[]>([]);
  const [dataTick, setDataTick] = useState(0);

  const refreshHistory = useCallback(() => {
    setHistory(loadCouncilSessions());
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const missionPreview = useMemo(() => {
    void dataTick;
    const cap = loadCapitalSettings();
    return buildCapitalReport({
      entries: loadDecisionLog(),
      orders: loadPaperOrders(),
      riskProfile: loadDeskSettings().riskProfile,
      latestAnalysis: null,
      settings: cap,
    });
  }, [dataTick]);

  const g = session?.goalStatus ?? null;
  const progressPct = g
    ? Math.min(100, Math.max(0, g.progressToGoalPct))
    : Math.min(
        100,
        Math.max(
          0,
          Math.round(
            ((missionPreview.stage.equityUsd - capStart()) /
              (20_000 - capStart())) *
              100,
          ),
        ),
      );

  function capStart() {
    return loadCapitalSettings().missionStartUsd;
  }

  const runCouncil = async () => {
    setBusy(true);
    setError(null);
    const cap = loadCapitalSettings();
    const body = {
      topic: topic.trim() || undefined,
      startingCapital: cap.missionStartUsd,
      goalCapital: 20_000,
      entries: loadDecisionLog(),
      orders: loadPaperOrders(),
      perpPositions: loadPerpPositions(),
      riskProfile: loadDeskSettings().riskProfile,
      adaptationProposals: loadAdaptationProposals(),
      incidents: loadIncidents(),
      councilSessions: loadCouncilSessions(),
      registryStrategies: buildStrategyRegistry({
        entries: loadDecisionLog(),
        orders: loadPaperOrders(),
        riskProfile: loadDeskSettings().riskProfile,
      }).strategies,
    };

    try {
      const response = await fetch("/api/council/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as CouncilSessionResult | { error: string };
      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : `HTTP ${response.status}`);
      }
      saveCouncilSession(payload);
      setSession(payload);
      refreshHistory();
      setDataTick((t) => t + 1);
    } catch (e) {
      const local = runCouncilSession({
        request: body,
        entries: body.entries ?? [],
        orders: body.orders ?? [],
        perpPositions: body.perpPositions ?? [],
        riskProfile: body.riskProfile ?? "balanced",
        adaptationProposals: body.adaptationProposals ?? [],
        incidents: body.incidents ?? [],
        councilSessions: body.councilSessions ?? [],
        registryStrategies: body.registryStrategies ?? [],
      });
      saveCouncilSession(local);
      setSession(local);
      refreshHistory();
      setDataTick((t) => t + 1);
      setError(
        e instanceof Error
          ? `${e.message} — session ran locally with browser journal.`
          : "Session ran locally.",
      );
    } finally {
      setBusy(false);
    }
  };

  const patchProposal = (
    proposalId: string,
    status: CouncilProposalStatus,
  ) => {
    if (!session) return;
    const updated = updateProposalStatus(session.councilSessionId, proposalId, status);
    if (updated) {
      setSession(updated);
      refreshHistory();
    }
  };

  const theme = OPS_ACCENT.amber;
  const verdict = session
    ? committeeDecisionStyles(session.committeeDecision.decision)
    : null;

  const equityDisplay = g
    ? g.currentEquityUsd
    : missionPreview.stage.equityUsd;

  return (
    <OpsShell
      badge="Strategy command · Analysis only"
      title="AI Strategy Council"
      subtitle="Six specialized agents debate how to accelerate the $1,000 → $20,000 mission while respecting hard risk locks. All output is advisory — paper tests and human approval gate any change to live desk behavior."
      accent="amber"
      iconLetters="SC"
      activePath="/council"
      nav={[
        { href: "/", label: "← Trading desk" },
        { href: "/capital", label: "Capital mission", primary: true },
        { href: "/strategies", label: "Strategy registry" },
        { href: "/governance", label: "Governance" },
      ]}
      actions={
        <>
          <span className="ops-chip ops-chip-live">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Paper-first
          </span>
          <span className="ops-chip">Hard rules locked</span>
        </>
      }
    >
      {/* Goal progress — always visible */}
      <section className="desk-panel px-5 py-5">
        <div className="ops-section-head">
          <h2 className="desk-section-title text-amber-300/80">Mission progress</h2>
          <span className="font-mono text-[10px] text-zinc-600">
            Target $20,000 · {missionPreview.stage.current.label}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <OpsKpi
            label="Equity"
            value={`$${equityDisplay.toLocaleString()}`}
            mono
          />
          <OpsKpi
            label="Stage"
            value={g?.stageLabel ?? missionPreview.stage.current.label}
          />
          <OpsKpi
            label="To $20k goal"
            value={
              g
                ? `$${g.distanceToGoalUsd.toLocaleString()}`
                : `$${missionPreview.stage.distanceToGoalUsd.toLocaleString()}`
            }
            hint={
              g
                ? `${g.progressToGoalPct}% of mission complete`
                : `${missionPreview.stage.progressToGoalPct}% complete`
            }
            mono
          />
          <OpsKpi
            label="Bottleneck"
            value={g?.bottleneck ?? "Run council to diagnose"}
            hint={g?.paceAssessment}
          />
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-[10px] text-zinc-600">
            <span>Mission track</span>
            <span className="font-mono text-zinc-500">{progressPct}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-zinc-900 ring-1 ring-zinc-800">
            <div
              className={`h-full ${theme.progress} transition-all duration-500`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </section>

      {/* Command center */}
      <section className="ops-panel-accent relative overflow-hidden px-5 py-5">
        <div className="ops-section-head">
          <h2 className="desk-section-title">Convene council</h2>
          {session && (
            <span className="font-mono text-[10px] text-zinc-600">
              {session.councilSessionId.slice(0, 8)}… ·{" "}
              {new Date(session.timestamp).toLocaleString()}
            </span>
          )}
        </div>
        <label className="block text-xs font-medium text-zinc-400">
          Council topic
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Accelerate short premium without raising drawdown budget"
            className="mt-2 w-full rounded-lg border border-zinc-700/80 bg-zinc-950/90 px-4 py-3 text-sm text-zinc-100 shadow-inner placeholder:text-zinc-600 focus:border-amber-700/60 focus:outline-none focus:ring-1 focus:ring-amber-600/30"
          />
        </label>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void runCouncil()}
            className={`rounded-lg px-5 py-2.5 text-sm font-semibold shadow-lg transition disabled:opacity-50 ${theme.btn}`}
          >
            {busy ? "Council in session…" : "Run council session"}
          </button>
          <button
            type="button"
            onClick={() => setDataTick((t) => t + 1)}
            className="rounded-lg border border-zinc-700 px-4 py-2.5 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
          >
            Refresh mission data
          </button>
        </div>
        {error && (
          <p className="mt-3 rounded-lg border border-amber-900/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-200/90">
            {error}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {COUNCIL_GUARDRAILS.map((rule) => (
            <span key={rule} className="ops-chip max-w-full normal-case" title={rule}>
              {rule.length > 48 ? `${rule.slice(0, 46)}…` : rule}
            </span>
          ))}
        </div>
        <div className="mt-4 border-t border-zinc-800/80 pt-4">
          <p className="desk-section-title mb-2">Desk capabilities in scope</p>
          <div className="flex flex-wrap gap-2">
            {COUNCIL_CAPABILITIES.map((c) => (
              <span
                key={c}
                className="rounded-md border border-zinc-800/80 bg-zinc-950/50 px-2 py-1 text-[10px] font-medium text-zinc-500"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      {!session && !busy && (
        <section className="desk-panel border-dashed px-5 py-10 text-center">
          <p className="text-sm font-medium text-zinc-400">
            No council session loaded
          </p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-zinc-600">
            Run a session to hear from Goal Strategist, Performance Analyst, Strategy
            Optimizer, Risk Critic, and Capital Allocator — then receive a moderated
            committee verdict and memo.
          </p>
          <p className="mt-4 font-mono text-[10px] text-zinc-700">
            {loadDecisionLog().length} decision log entries ·{" "}
            {loadPaperOrders().length} paper orders
          </p>
        </section>
      )}

      {session && verdict && (
        <>
          <div className={verdict.verdict}>
            <p className="desk-section-title text-zinc-500">Committee verdict</p>
            <p className={`mt-1 text-lg font-bold tracking-tight ${verdict.label}`}>
              {session.committeeDecision.decision.replace(/_/g, " ")}
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              {session.committeeDecision.summary}
            </p>
            {session.topic && (
              <p className="mt-2 text-[11px] text-zinc-600">
                Topic: <span className="text-zinc-500">{session.topic}</span>
              </p>
            )}
          </div>

          <div className="grid gap-5 xl:grid-cols-12">
            {/* Left column — debate + proposals */}
            <div className="space-y-5 xl:col-span-7">
              <section className="desk-panel px-5 py-5">
                <div className="ops-section-head">
                  <h2 className="desk-section-title">Agent debate</h2>
                  <span className="text-[10px] text-zinc-600">
                    {session.agentDebate.length} voices
                  </span>
                </div>
                <div className="space-y-3">
                  {session.agentDebate.map((row) => {
                    const st = stanceStyles(row.stance);
                    return (
                      <article
                        key={row.agentName}
                        className={`ops-agent-card border ${st.border}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 font-mono text-[11px] font-bold text-amber-200/90 ring-1 ring-zinc-800">
                            {agentInitials(row.agentName)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-zinc-100">
                                {row.agentName}
                              </p>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${st.badge}`}
                              >
                                {st.label}
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-600">{row.role}</p>
                            <ul className="mt-2.5 space-y-1.5">
                              {row.statements.map((s) => (
                                <li
                                  key={s}
                                  className="flex gap-2 text-[12px] leading-relaxed text-zinc-400"
                                >
                                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
                                  <span>{s}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              <section className="desk-panel px-5 py-5">
                <div className="ops-section-head">
                  <h2 className="desk-section-title">Strategy proposals</h2>
                  <span className="text-[10px] text-zinc-600">All start DRAFT</span>
                </div>
                <div className="space-y-3">
                  {session.proposals.map((p) => (
                    <article
                      key={p.id}
                      className="rounded-lg border border-zinc-800/90 bg-zinc-950/40 px-4 py-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-zinc-50">{p.title}</p>
                          <p className="mt-0.5 font-mono text-[10px] text-zinc-600">
                            {p.id} · {p.targetStrategy} · {p.testMode}
                          </p>
                        </div>
                        <span className={proposalStatusStyles(p.status)}>
                          {p.status}
                        </span>
                      </div>
                      <dl className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2">
                        <div>
                          <dt className="text-zinc-600">Problem</dt>
                          <dd className="text-zinc-400">{p.problemObserved}</dd>
                        </div>
                        <div>
                          <dt className="text-zinc-600">Change</dt>
                          <dd className="text-zinc-300">{p.proposedChange}</dd>
                        </div>
                        <div>
                          <dt className="text-emerald-700/80">Expected benefit</dt>
                          <dd className="text-emerald-400/80">{p.expectedBenefit}</dd>
                        </div>
                        <div>
                          <dt className="text-rose-700/80">Risk concern</dt>
                          <dd className="text-rose-400/80">{p.riskConcern}</dd>
                        </div>
                      </dl>
                      <p className="mt-2 text-[10px] text-zinc-600">
                        Min sample {p.requiredSampleSize} · human approval required for
                        promotion
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            {/* Right column — risk, capital, board, memo */}
            <div className="space-y-5 xl:col-span-5">
              <section className="desk-panel px-5 py-5">
                <h2 className="desk-section-title">Risk critic review</h2>
                <ul className="mt-3 space-y-1.5">
                  {session.riskReview.globalWarnings.map((w) => (
                    <li
                      key={w}
                      className="flex gap-2 text-[11px] text-amber-200/80"
                    >
                      <span aria-hidden>⚠</span>
                      {w}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 space-y-2">
                  {session.riskReview.items.map((item) => (
                    <div
                      key={item.proposalId}
                      className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2.5 text-[11px]"
                    >
                      <p className="font-mono text-[10px] text-zinc-500">
                        {item.proposalId}
                      </p>
                      <p className="mt-1 text-zinc-300">{item.summary}</p>
                      <p className="mt-1 text-zinc-600">
                        DD · {item.drawdownRisk} · Overfit · {item.overfittingRisk}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="ops-chip">Rules locked</span>
                  <span className="ops-chip">No live execution</span>
                  <span className="ops-chip">No auto size-up</span>
                </div>
              </section>

              <section className="desk-panel px-5 py-5">
                <h2 className="desk-section-title">Capital allocation</h2>
                <div className="mt-3">
                  <AllocationBar
                    reserve={session.capitalRecommendation.reservePct}
                    core={session.capitalRecommendation.coreStrategyPct}
                    growth={session.capitalRecommendation.growthStrategyPct}
                    experimental={session.capitalRecommendation.experimentalPct}
                  />
                </div>
                <p className="mt-3 text-xs leading-relaxed text-zinc-500">
                  {session.capitalRecommendation.councilNote}
                </p>
                {session.capitalRecommendation.aggressiveIncreaseBlocked && (
                  <p className="mt-2 rounded-lg border border-rose-900/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-300/90">
                    Aggressive allocation increase blocked — insufficient proof at
                    current milestone.
                  </p>
                )}
                <Link
                  href="/capital"
                  className="mt-3 inline-block text-xs text-violet-400 hover:underline"
                >
                  Open capital mission →
                </Link>
              </section>

              <section className="desk-panel px-5 py-5">
                <h2 className="desk-section-title">Per-proposal committee rulings</h2>
                <ul className="mt-3 max-h-48 space-y-2 overflow-auto">
                  {session.committeeDecision.proposalDecisions.map((d) => (
                    <li
                      key={d.proposalId}
                      className="rounded border border-zinc-800/80 px-3 py-2 text-[11px]"
                    >
                      <span className="font-mono text-zinc-500">{d.proposalId}</span>
                      <span className="ml-2 font-semibold text-zinc-300">
                        {d.decision.replace(/_/g, " ")}
                      </span>
                      <p className="mt-1 text-zinc-600">{d.rationale}</p>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="desk-panel px-5 py-5">
                <h2 className="desk-section-title">Adaptation engine (reference)</h2>
                <p className="mt-1 text-[11px] text-zinc-600">
                  Council sees adaptation proposals for context only — cannot approve or
                  apply. Use /adaptation for human approval.
                </p>
                {(session.adaptationProposalsReferenced ?? []).length === 0 ? (
                  <p className="mt-3 text-xs text-zinc-500">
                    No adaptation proposals in this session. Run analysis on{" "}
                    <Link href="/adaptation" className="text-indigo-400 hover:underline">
                      /adaptation
                    </Link>
                    .
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {(session.adaptationProposalsReferenced ?? []).map((p) => (
                      <li
                        key={p.proposalId}
                        className="rounded border border-indigo-900/40 bg-indigo-950/20 px-3 py-2 text-[11px]"
                      >
                        <span className="font-semibold text-indigo-200">
                          {p.type}
                        </span>{" "}
                        <span className="text-zinc-300">{p.targetStrategy}</span> ·{" "}
                        {p.status} · conf {p.confidence}%
                        <p className="mt-1 text-zinc-500">{p.reason}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  href="/adaptation"
                  className="mt-3 inline-block text-xs text-indigo-400 hover:underline"
                >
                  Open adaptation desk →
                </Link>
              </section>

              <section className="desk-panel px-5 py-5">
                <div className="ops-section-head">
                  <h2 className="desk-section-title">Council memo</h2>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(session.councilMemo)}
                    className="rounded-md border border-zinc-700 px-2 py-1 text-[10px] text-amber-400 hover:bg-zinc-900"
                  >
                    Copy
                  </button>
                </div>
                <pre className="ops-memo">{session.councilMemo}</pre>
              </section>

              <section className="desk-panel px-5 py-5">
                <h2 className="desk-section-title">Human proposal board</h2>
                <p className="mt-1 text-[11px] text-zinc-600">
                  Operator-only — does not alter live desk, hard rules, or exchange
                  orders.
                </p>
                <div className="mt-3 space-y-2">
                  {session.proposals.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2.5"
                    >
                      <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">
                        {p.title}
                      </span>
                      <select
                        value={p.status}
                        onChange={(e) =>
                          patchProposal(p.id, e.target.value as CouncilProposalStatus)
                        }
                        className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-[10px] font-medium text-zinc-200 focus:border-amber-700/50 focus:outline-none"
                      >
                        <option value="DRAFT">DRAFT</option>
                        <option value="APPROVED_FOR_PAPER">APPROVED_FOR_PAPER</option>
                        <option value="REJECTED">REJECTED</option>
                        <option value="NEED_MORE_DATA">NEED_MORE_DATA</option>
                        <option value="PROMOTED">PROMOTED</option>
                        <option value="DISABLED">DISABLED</option>
                      </select>
                    </div>
                  ))}
                </div>
                <Link
                  href="/strategies"
                  className="mt-3 inline-block text-xs text-indigo-400 hover:underline"
                >
                  Manage strategy registry →
                </Link>
              </section>
            </div>
          </div>
        </>
      )}

      {history.length > 0 && (
        <section className="desk-panel px-5 py-4">
          <h2 className="desk-section-title">Session archive</h2>
          <ul className="mt-3 divide-y divide-zinc-800/80">
            {history.slice(0, 10).map((s) => {
              const v = committeeDecisionStyles(s.committeeDecision.decision);
              return (
                <li key={s.councilSessionId}>
                  <button
                    type="button"
                    onClick={() => setSession(s)}
                    className="flex w-full flex-wrap items-center justify-between gap-2 py-2.5 text-left transition hover:bg-zinc-900/40"
                  >
                    <span className="font-mono text-[11px] text-zinc-500">
                      {s.timestamp.slice(0, 19).replace("T", " ")}
                    </span>
                    <span className={`text-xs font-semibold ${v.label}`}>
                      {s.committeeDecision.decision.replace(/_/g, " ")}
                    </span>
                    <span className="text-[10px] text-zinc-600">
                      {s.proposals.length} proposals
                      {s.topic ? ` · ${s.topic.slice(0, 40)}` : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </OpsShell>
  );
}
