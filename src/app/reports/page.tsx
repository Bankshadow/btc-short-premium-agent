"use client";

import { useState } from "react";
import { fetchJson } from "@/lib/api/fetch-json";
import { Badge, LoadingOrError, StatCard, useApi } from "@/components/use-api";
import { BinanceTestnetDiagnosticsPanel } from "@/components/BinanceTestnetDiagnosticsPanel";
import type { ReportsSummary } from "@/lib/reports/reports-types";
import type { ReportsGateStatus } from "@/lib/reports/execution-safety-report";

function gateTone(status: ReportsGateStatus): "safe" | "blocked" | "wait" {
  if (status === "READY_FOR_EXECUTION_NEXT_MVP") return "safe";
  if (status === "NO_PREVIEW" || status === "READY_FOR_REVIEW") return "wait";
  return "blocked";
}

function healthTone(status: string): "safe" | "blocked" | "wait" {
  if (status === "OK") return "safe";
  if (status === "WARNING") return "wait";
  return "blocked";
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="font-mono text-sm">{value}</p>
    </div>
  );
}

export default function ReportsPage() {
  const { data, error, loading, reload } = useApi<ReportsSummary>("/api/reports/summary");
  const [generatingAudit, setGeneratingAudit] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [creatingBriefing, setCreatingBriefing] = useState(false);
  const [evaluatingRisk, setEvaluatingRisk] = useState(false);
  const [creatingReplay, setCreatingReplay] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data: replayData, reload: reloadReplay } = useApi<{ sessions: Array<{ sessionId: string; tradeId: string | null; createdAt: string; stepCount: number }> }>(
    "/api/replay/sessions",
  );

  async function createBriefing() {
    setCreatingBriefing(true);
    setActionError(null);
    try {
      await fetchJson("/api/briefing/create", { method: "POST" });
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Briefing creation failed");
    } finally {
      setCreatingBriefing(false);
    }
  }

  async function evaluatePortfolioRisk() {
    setEvaluatingRisk(true);
    setActionError(null);
    try {
      await fetchJson("/api/portfolio-risk/evaluate", { method: "POST" });
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Portfolio risk evaluate failed");
    } finally {
      setEvaluatingRisk(false);
    }
  }

  async function createReplay() {
    setCreatingReplay(true);
    setActionError(null);
    try {
      await fetchJson("/api/replay/sessions", { method: "POST", body: JSON.stringify({}) });
      reloadReplay();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Replay creation failed");
    } finally {
      setCreatingReplay(false);
    }
  }

  async function generateAuditPack() {
    setGeneratingAudit(true);
    setAuditError(null);
    try {
      await fetchJson("/api/audit/generate", { method: "POST" });
      reload();
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : "Audit generation failed");
    } finally {
      setGeneratingAudit(false);
    }
  }

  const pending = LoadingOrError({ loading, error, onRetry: reload });
  if (pending) return pending;
  if (!data) return <p className="empty-state">No reports data.</p>;

  const { mission, executionSafetyGate: gate, pnlSummary, learningSummary } = data;
  const tone = gateTone(gate.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Reports</h2>
          <p className="text-sm text-[var(--muted)]">
            MVP 24 · Generated {new Date(data.generatedAt).toLocaleString()}
          </p>
        </div>
        <button type="button" className="btn" onClick={reload}>
          Refresh
        </button>
      </div>

      {auditError ? <div className="error-box">{auditError}</div> : null}
      {actionError ? <div className="error-box">{actionError}</div> : null}

      {!data.readyForMvp5 ? (
        <section className="panel text-sm text-[var(--muted)]">{data.readyForMvp5Message}</section>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Mission Snapshot</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Current equity"
            value={`$${mission.currentEquity.toLocaleString()}`}
          />
          <StatCard label="Progress" value={`${mission.progressPct}%`} />
          <StatCard label="Net PnL" value={`$${mission.netPnl.toFixed(2)}`} />
          <StatCard
            label="Trades"
            value={`${mission.totalTrades} (${mission.win}W/${mission.loss}L/${mission.breakeven ?? 0}BE)`}
          />
        </div>
      </section>

      <section className="panel space-y-3">
        <h3 className="text-lg font-semibold">Realized PnL</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Closed with PnL" value={String(pnlSummary.count)} />
          <StatCard label="Wins / Losses / BE" value={`${pnlSummary.wins}/${pnlSummary.losses}/${pnlSummary.breakeven}`} />
          <StatCard label="Total net PnL" value={`$${pnlSummary.totalNetPnl.toFixed(2)}`} />
          <StatCard label="Average PnL" value={`$${pnlSummary.averagePnl.toFixed(2)}`} />
        </div>
        {pnlSummary.bestTrade ? (
          <p className="text-sm text-[var(--muted)]">
            Best: {pnlSummary.bestTrade.symbol} ${pnlSummary.bestTrade.netPnl.toFixed(2)} · Worst:{" "}
            {pnlSummary.worstTrade?.symbol ?? "—"} $
            {pnlSummary.worstTrade?.netPnl.toFixed(2) ?? "—"}
          </p>
        ) : (
          <p className="text-sm text-[var(--muted)]">No realized PnL records yet.</p>
        )}
        {data.positionStats.realizedPnlPending ? (
          <Badge tone="wait">Some closed positions pending PnL calculation</Badge>
        ) : null}
      </section>

      <section className="panel space-y-3">
        <h3 className="text-lg font-semibold">Evidence Progress</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="wait">
            Trust {data.evidenceProgress.valid}/{data.evidenceProgress.required}
          </Badge>
          <Badge tone={data.evidenceProgress.readinessStatus === "READY" ? "safe" : "wait"}>
            {data.evidenceProgress.readinessStatus ?? "COLLECTING"}
          </Badge>
          <Badge tone="safe">Live locked</Badge>
        </div>
        <p className="text-sm text-[var(--muted)]">
          {data.evidenceProgress.valid} valid evidence trades · {data.evidenceProgress.invalid}{" "}
          rejected · {data.evidenceProgress.required - data.evidenceProgress.valid} remaining to
          target.
        </p>
        {(data.evidenceProgress.trades?.length ?? 0) > 0 ? (
          <div className="space-y-2">
            {data.evidenceProgress.trades!.slice(0, 8).map((t) => (
              <div key={t.tradeId} className="rounded border border-[var(--border)] p-2 text-xs">
                <Badge tone={t.status === "VALID" ? "safe" : "blocked"}>{t.status}</Badge>
                <span className="ml-2 font-mono">{t.tradeId}</span>
                {t.status === "REJECTED" && t.rejectionReasons.length > 0 ? (
                  <p className="mt-1 text-[var(--danger)]">{t.rejectionReasons.join("; ")}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="panel space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">Portfolio risk</h3>
          <button
            type="button"
            className="btn"
            disabled={evaluatingRisk}
            onClick={evaluatePortfolioRisk}
          >
            {evaluatingRisk ? "Evaluating…" : "Evaluate portfolio risk"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge
            tone={
              data.portfolioRisk.status === "OK"
                ? "safe"
                : data.portfolioRisk.status === "WARNING"
                  ? "wait"
                  : "blocked"
            }
          >
            {data.portfolioRisk.status}
          </Badge>
          {data.portfolioRisk.blocksExecution ? (
            <Badge tone="blocked">Blocks new execution</Badge>
          ) : null}
          <Badge tone="safe">Live locked</Badge>
        </div>
        <p className="text-sm text-[var(--muted)]">{data.portfolioRisk.message}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Daily PnL" value={`$${data.portfolioRisk.dailyPnl.toFixed(2)}`} />
          <StatCard label="Drawdown" value={`${data.portfolioRisk.drawdownPct}%`} />
          <StatCard label="Open exposure" value={`$${data.portfolioRisk.openExposureUsd.toFixed(2)}`} />
          <StatCard label="Open positions" value={String(data.portfolioRisk.openPositions)} />
        </div>
        {data.portfolioRisk.issues.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {data.portfolioRisk.issues.map((i) => (
              <li key={i.code} className="text-[var(--danger)]">
                {i.code}: {i.message}
              </li>
            ))}
          </ul>
        ) : null}
        {data.portfolioRiskHistory.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Risk history</p>
            {data.portfolioRiskHistory.map((h) => (
              <div key={h.timestamp} className="rounded border border-[var(--border)] p-2 text-xs">
                <span className="font-mono">{new Date(h.timestamp).toLocaleString()}</span>
                <span className="ml-2">{h.status}</span>
                {h.blocksExecution ? (
                  <Badge tone="blocked">blocked</Badge>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">No portfolio risk evaluations yet.</p>
        )}
      </section>

      <section className="panel space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">Daily briefing</h3>
          <button
            type="button"
            className="btn"
            disabled={creatingBriefing}
            onClick={createBriefing}
          >
            {creatingBriefing ? "Creating…" : "Generate briefing"}
          </button>
        </div>
        {data.latestBriefing ? (
          <>
            <p className="text-xs text-[var(--muted)]">
              {new Date(data.latestBriefing.createdAt).toLocaleString()}
            </p>
            <p className="text-sm">{data.latestBriefing.nextRecommendedAction}</p>
            <p className="text-sm text-[var(--muted)]">Risk: {data.latestBriefing.riskState}</p>
            {data.latestBriefing.learningHighlights.length > 0 ? (
              <ul className="list-inside list-disc text-sm text-[var(--muted)]">
                {data.latestBriefing.learningHighlights.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">No briefing yet — generate one from mission state.</p>
        )}
      </section>

      <section className="panel space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">Session replay</h3>
          <button
            type="button"
            className="btn"
            disabled={creatingReplay}
            onClick={createReplay}
          >
            {creatingReplay ? "Creating…" : "Create replay (latest trade)"}
          </button>
        </div>
        {(replayData?.sessions?.length ?? 0) > 0 ? (
          <div className="space-y-2">
            {replayData!.sessions.slice(0, 5).map((s) => (
              <div key={s.sessionId} className="rounded border border-[var(--border)] p-2 text-xs">
                <span className="font-mono">{s.sessionId}</span>
                <span className="ml-2 text-[var(--muted)]">
                  {s.tradeId ?? "—"} · {s.stepCount} steps ·{" "}
                  {new Date(s.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">No replay sessions yet.</p>
        )}
      </section>

      <section className="panel space-y-3">
        <h3 className="text-lg font-semibold">Micro-live readiness</h3>
        <div className="flex flex-wrap gap-2">
          <Badge tone={data.microLiveReadiness.status === "NOT_READY" ? "wait" : "safe"}>
            {data.microLiveReadiness.status}
          </Badge>
          <Badge
            tone={
              data.microLiveReadiness.recommendation === "READY_FOR_CONTROLLED_MICRO_LIVE"
                ? "safe"
                : "blocked"
            }
          >
            {data.microLiveReadiness.recommendation}
          </Badge>
        </div>
        {data.microLiveReadiness.gaps.length > 0 ? (
          <ul className="list-inside list-disc text-sm text-[var(--muted)]">
            {data.microLiveReadiness.gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--muted)]">All core criteria met — operator approval may still be pending.</p>
        )}
        <details>
          <summary className="cursor-pointer text-sm text-[var(--muted)]">Readiness checklist</summary>
          <div className="mt-2 space-y-1">
            {data.microLiveReadiness.criteria.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-sm">
                <Badge tone={c.met ? "safe" : "blocked"}>{c.met ? "met" : "gap"}</Badge>
                <span>{c.label}</span>
                <span className="text-[var(--muted)]">({c.detail})</span>
              </div>
            ))}
          </div>
        </details>
      </section>

      <section className="panel space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">Audit pack</h3>
          <button
            type="button"
            className="btn"
            disabled={generatingAudit}
            onClick={generateAuditPack}
          >
            {generatingAudit ? "Generating…" : "Generate audit pack"}
          </button>
        </div>
        {data.latestAuditPack ? (
          <>
            <p className="text-xs text-[var(--muted)]">
              {data.latestAuditPack.auditId} ·{" "}
              {new Date(data.latestAuditPack.generatedAt).toLocaleString()}
            </p>
            <Badge
              tone={
                data.latestAuditPack.recommendation === "READY_FOR_CONTROLLED_MICRO_LIVE"
                  ? "safe"
                  : "wait"
              }
            >
              {data.latestAuditPack.recommendation}
            </Badge>
            <div className="space-y-1">
              {data.latestAuditPack.sections.map((s) => (
                <div key={s.name} className="rounded border border-[var(--border)] p-2 text-xs">
                  <span className="font-semibold">{s.name}</span>
                  <span className="ml-2 text-[var(--muted)]">
                    {s.itemCount} · {s.summary}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">No audit pack generated yet.</p>
        )}
      </section>

      <section className="panel space-y-3">
        <h3 className="text-lg font-semibold">Live sandbox</h3>
        <Badge tone="safe">Live locked</Badge>
        <p className="text-sm text-[var(--muted)]">{data.liveSandbox.message}</p>
        {data.liveSandbox.blockers.length > 0 ? (
          <ul className="list-inside list-disc text-sm text-[var(--muted)]">
            {data.liveSandbox.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="panel space-y-3">
        <h3 className="text-lg font-semibold">Engine reliability</h3>
        <div className="flex flex-wrap gap-2">
          <Badge tone={healthTone(data.engineHealth.status)}>{data.engineHealth.status}</Badge>
          {data.engineHealth.blocksExecution ? (
            <Badge tone="blocked">Execution blocked</Badge>
          ) : null}
        </div>
        <p className="text-sm text-[var(--muted)]">{data.engineHealth.message}</p>
        {data.engineHealth.issues.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {data.engineHealth.issues.map((i) => (
              <li key={i.code} className="text-[var(--danger)]">
                {i.code}: {i.message}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="panel space-y-3">
        <h3 className="text-lg font-semibold">Strategy quality</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Evidence trades" value={String(data.strategyHealth.evidenceTrades)} />
          <StatCard label="Win rate" value={`${(data.strategyHealth.winRate * 100).toFixed(1)}%`} />
          <StatCard label="Avg PnL" value={`$${data.strategyHealth.averagePnl.toFixed(2)}`} />
          <StatCard label="Max loss" value={`$${data.strategyHealth.maxLoss.toFixed(2)}`} />
        </div>
        <p className="text-sm text-[var(--muted)]">{data.strategyHealth.message}</p>
        {data.strategyHealth.bestSetup ? (
          <p className="text-sm">
            Best setup: {data.strategyHealth.bestSetup} · Worst:{" "}
            {data.strategyHealth.worstSetup ?? "—"}
          </p>
        ) : null}
      </section>

      {data.swarmReport ? (
        <section className="panel space-y-3">
          <h3 className="text-lg font-semibold">Analysis vs swarm</h3>
          <p className="text-sm">
            Verdict: {data.analysisComparison.verdict ?? "—"} · Swarm:{" "}
            {data.analysisComparison.swarmSignal ?? "—"} · Agreement:{" "}
            {data.analysisComparison.swarmAgreement ?? "—"}
          </p>
          {data.analysisComparison.scenarioNote ? (
            <p className="text-xs text-[var(--muted)]">{data.analysisComparison.scenarioNote}</p>
          ) : null}
        </section>
      ) : null}

      {data.regimeMemory ? (
        <section className="panel space-y-3">
          <h3 className="text-lg font-semibold">Regime memory</h3>
          <Badge tone="wait">{data.regime?.regime ?? data.regimeMemory.currentRegime}</Badge>
          {data.regimeMemory.lessons.length > 0 ? (
            <ul className="list-inside list-disc text-sm text-[var(--muted)]">
              {data.regimeMemory.lessons.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--muted)]">No similar past lessons yet.</p>
          )}
        </section>
      ) : null}

      {data.swarmReport ? (
        <section className="panel space-y-3">
          <h3 className="text-lg font-semibold">Scenario swarm (advisory)</h3>
          <div className="flex flex-wrap gap-2">
            <Badge tone="wait">{data.swarmReport.advisorySignal}</Badge>
            <Badge tone="safe">{data.swarmReport.recommendedAction}</Badge>
          </div>
          <p className="text-sm">{data.swarmReport.likelyScenario}</p>
          <p className="text-xs text-[var(--muted)]">{data.swarmReport.safetyNote}</p>
          <details>
            <summary className="cursor-pointer text-sm text-[var(--muted)]">Agent votes</summary>
            <div className="mt-2 space-y-2">
              {data.swarmReport.agentVotes.map((v) => (
                <div key={v.agentId} className="rounded border border-[var(--border)] p-2 text-xs">
                  <span className="font-semibold">{v.role}</span> · {v.vote} · {v.confidence}%
                  <p className="text-[var(--muted)]">{v.reasoning}</p>
                </div>
              ))}
            </div>
          </details>
        </section>
      ) : null}

      <section className="panel space-y-3">
        <h3 className="text-lg font-semibold">Learning</h3>
        <StatCard label="Learning records" value={String(learningSummary.count)} />
        {learningSummary.latestLessons.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {learningSummary.latestLessons.map((l) => (
              <li key={l.tradeId} className="rounded border border-[var(--border)] p-2">
                <Badge tone={l.result === "WIN" ? "safe" : l.result === "LOSS" ? "blocked" : "wait"}>
                  {l.result}
                </Badge>
                <span className="ml-2 text-[var(--muted)]">{l.tradeId}</span>
                <p className="mt-1">{l.lesson}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--muted)]">No learning records yet.</p>
        )}
        {learningSummary.repeatedMistakes.length > 0 ? (
          <p className="text-sm text-[var(--danger)]">
            Repeated mistakes: {learningSummary.repeatedMistakes.join("; ")}
          </p>
        ) : null}
        {learningSummary.repeatedStrengths.length > 0 ? (
          <p className="text-sm text-[var(--success)]">
            Repeated strengths: {learningSummary.repeatedStrengths.join("; ")}
          </p>
        ) : null}
      </section>

      <section className="panel space-y-3">
        <h3 className="text-lg font-semibold">Position monitor &amp; close</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Open positions"
            value={String(data.positionStats.openPositionsCount)}
          />
          <StatCard
            label="Monitored"
            value={String(data.positionStats.monitoredPositionsCount)}
          />
          <StatCard
            label="Close previews"
            value={String(data.positionStats.closePreviewsCount)}
          />
          <StatCard
            label="Close safety"
            value={data.positionStats.latestCloseSafetyStatus}
          />
          <StatCard
            label="Closed positions"
            value={String(data.positionStats.closedPositionsCount)}
          />
          <StatCard
            label="Reconciliation"
            value={data.positionStats.reconciliationStatus}
          />
        </div>
      </section>

      <section className="panel space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">Execution Safety Gate</h3>
          <Badge tone={tone}>{gate.status}</Badge>
        </div>

        {gate.status === "NO_PREVIEW" ? (
          <p className="text-sm">{gate.nextSafeAction}</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge tone={gate.previewExpired ? "blocked" : "safe"}>
                Preview expiry: {gate.previewExpired ? "expired" : "valid"}
              </Badge>
              <Badge tone={gate.duplicateDetected ? "blocked" : "safe"}>
                Duplicate: {gate.duplicateDetected ? "detected" : "none"}
              </Badge>
              <Badge tone={gate.doubleConfirmProvided ? "safe" : "wait"}>
                Double confirm: {gate.doubleConfirmProvided ? "provided" : "required"}
              </Badge>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded border border-[var(--border)] p-3">
                <h4 className="text-sm font-semibold">Latest preview</h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="previewId" value={gate.previewId ?? "—"} />
                  <Field label="runId" value={gate.runId ?? "—"} />
                  <Field label="decisionLogId" value={gate.decisionLogId ?? "—"} />
                  <Field label="symbol" value={gate.symbol ?? "—"} />
                  <Field label="side" value={gate.side ?? "—"} />
                  <Field label="status" value={gate.previewStatus ?? "—"} />
                </div>
              </div>

              <div className="space-y-3 rounded border border-[var(--border)] p-3">
                <h4 className="text-sm font-semibold">Latest review result</h4>
                <Field label="review status" value={gate.latestReviewStatus} />
                {gate.latestReviewMessage ? (
                  <p className="text-sm text-[var(--muted)]">{gate.latestReviewMessage}</p>
                ) : (
                  <p className="text-sm text-[var(--muted)]">No review yet.</p>
                )}
              </div>
            </div>

            <div className="rounded border border-[var(--border)] p-3">
              <p className="text-sm font-medium">Next safe action</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{gate.nextSafeAction}</p>
            </div>

            {gate.blockers.length > 0 ? (
              <div>
                <p className="mb-2 text-sm font-medium text-[var(--danger)]">Blockers</p>
                <ul className="space-y-2">
                  {gate.blockers.map((b) => (
                    <li
                      key={b.code}
                      className="rounded border border-[var(--danger)]/30 bg-[var(--danger)]/5 p-2 text-sm"
                    >
                      <span className="font-mono font-semibold">{b.code}</span>
                      <p className="text-[var(--muted)]">{b.message}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </section>

      <BinanceTestnetDiagnosticsPanel data={data.binanceStatus} title="Binance testnet" />

      <section className="panel space-y-3">
        <h3 className="text-lg font-semibold">Risk &amp; Readiness</h3>
        <div className="flex flex-wrap gap-2">
          <Badge tone="safe">Live locked</Badge>
          <Badge tone="safe">Manual execute only</Badge>
          <Badge tone="wait">
            Trust progress {data.evidenceProgress.valid}/{data.evidenceProgress.required}
          </Badge>
        </div>
        <p className="text-sm text-[var(--muted)]">
          12/12 evidence does not auto-enable live. Double confirm required · Auto-execute off.
        </p>
      </section>

      {gate.recentSafetyEvents.length > 0 ? (
        <section className="panel space-y-3">
          <h3 className="text-lg font-semibold">Recent safety events</h3>
          <div className="space-y-2">
            {gate.recentSafetyEvents.map((e) => (
              <div
                key={e.eventId}
                className="rounded border border-[var(--border)] p-2 text-xs"
              >
                <span className="font-mono text-[var(--accent)]">{e.type}</span>
                <span className="ml-2 text-[var(--muted)]">
                  {new Date(e.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
