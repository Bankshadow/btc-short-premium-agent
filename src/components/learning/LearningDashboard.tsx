"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import {
  mergeEvaluationResults,
  loadEvaluationResults,
  type LearningEvaluationReport,
} from "@/lib/self-learning";
import { SELF_LEARNING_SAFETY_NOTICE } from "@/lib/self-learning/types";
import ConfidenceCalibrationPanel from "./ConfidenceCalibrationPanel";
import TradeQualityPanel from "./TradeQualityPanel";
import { IntegratedDailySelfReviewPanel } from "@/components/integrated-daily-self-review/IntegratedDailySelfReviewPanel";
import type { IntegratedDailySelfReviewSnapshot } from "@/lib/integrated-daily-self-review/types";
import type { ConfidenceCalibrationProfile } from "@/lib/confidence-calibration/types";
import type { TradeQualitySummary } from "@/lib/trade-quality-score/types";

function gradeClass(grade: string): string {
  if (grade === "A") return "text-emerald-300";
  if (grade === "B") return "text-teal-300";
  if (grade === "C") return "text-amber-300";
  if (grade === "D") return "text-orange-300";
  if (grade === "F") return "text-rose-300";
  return "text-zinc-500";
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

export default function LearningDashboard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<LearningEvaluationReport | null>(null);
  const [calibration, setCalibration] = useState<ConfidenceCalibrationProfile | null>(null);
  const [tradeQuality, setTradeQuality] = useState<TradeQualitySummary | null>(null);
  const [dailySelfReview, setDailySelfReview] =
    useState<IntegratedDailySelfReviewSnapshot | null>(null);

  const loadDailySelfReview = useCallback(async () => {
    try {
      const res = await fetch("/api/integrated-daily-self-review", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setDailySelfReview(
          (data.dailySelfReview as IntegratedDailySelfReviewSnapshot | null) ?? null,
        );
      }
    } catch {
      /* optional */
    }
  }, []);

  const loadCalibration = useCallback(async () => {
    try {
      const res = await fetch("/api/confidence-calibration/status", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setCalibration((data.status?.profile as ConfidenceCalibrationProfile | null) ?? null);
      }
    } catch {
      /* optional */
    }
  }, []);

  const loadTradeQuality = useCallback(async () => {
    try {
      const res = await fetch("/api/trade-quality-score/status", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setTradeQuality((data.status?.summary as TradeQualitySummary | null) ?? null);
      }
    } catch {
      /* optional */
    }
  }, []);

  const recomputeTradeQuality = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/trade-quality-score/recompute", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setTradeQuality(data.summary as TradeQualitySummary);
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const recomputeCalibration = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/confidence-calibration/recompute", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setCalibration(data.profile as ConfidenceCalibrationProfile);
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    const entries = loadDecisionLog();
    const storedResults = loadEvaluationResults();

    try {
      await Promise.all([loadCalibration(), loadTradeQuality(), loadDailySelfReview()]);
      const res = await fetch("/api/self-learning/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries, storedResults }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? res.statusText);
      }
      setReport(data.report as LearningEvaluationReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report load failed");
    } finally {
      setBusy(false);
    }
  }, [loadCalibration, loadTradeQuality, loadDailySelfReview]);

  const runEvaluate = useCallback(async () => {
    setBusy(true);
    setError(null);
    const entries = loadDecisionLog();
    try {
      const res = await fetch("/api/self-learning/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries, batch: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? res.statusText);
      }
      if (data.results?.length) {
        mergeEvaluationResults(data.results);
      }
      setReport(data.report as LearningEvaluationReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evaluation failed");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <OpsShell
      badge="MVP 29 · Advisory evaluation"
      title="Self-Learning Evaluation"
      subtitle="Grades agent recommendations and reasoning after outcomes are known — proposals only."
      accent="teal"
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
            onClick={() => void runEvaluate()}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-teal-600 disabled:opacity-50"
          >
            {busy ? "Evaluating…" : "Re-evaluate all"}
          </button>
        </div>
      }
    >
      <p className="mb-4 rounded-lg border border-teal-900/40 bg-teal-950/20 px-3 py-2 text-sm text-teal-200/90">
        {SELF_LEARNING_SAFETY_NOTICE}{" "}
        <Link href="/adaptation" className="underline">
          Adaptation proposals
        </Link>{" "}
        require human approval.
      </p>

      {error ? <p className="mb-4 text-sm text-rose-300">{error}</p> : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OpsKpi
          label="Evaluations"
          value={String(report?.totalEvaluations ?? "—")}
        />
        <OpsKpi
          label="Agents graded"
          value={String(report?.agentLeaderboard.length ?? "—")}
        />
        <OpsKpi
          label="Weaknesses"
          value={String(report?.agentWeaknesses.length ?? "—")}
        />
        <OpsKpi
          label="Improvement ideas"
          value={String(report?.improvementRecommendations.length ?? "—")}
        />
      </div>

      <Panel title="Trade quality score">
        <TradeQualityPanel
          summary={tradeQuality}
          busy={busy}
          onRecompute={() => void recomputeTradeQuality()}
        />
      </Panel>

      <Panel title="AI confidence calibration">
        <ConfidenceCalibrationPanel
          profile={calibration}
          busy={busy}
          onRecompute={() => void recomputeCalibration()}
        />
      </Panel>

      <Panel title="Integrated daily AI self-review (MVP 79)">
        <IntegratedDailySelfReviewPanel
          dailyReview={dailySelfReview}
          showCursorTask={false}
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Agent Leaderboard">
          {report?.agentLeaderboard.length ? (
            <ul className="space-y-3 text-sm">
              {report.agentLeaderboard.map((agent) => (
                <li
                  key={agent.agentName}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-zinc-100">
                      {agent.agentName}
                    </span>
                    <span className={`font-bold ${gradeClass(agent.overallGrade)}`}>
                      {agent.overallGrade}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">
                    Hit {agent.prediction.hitRate}% · helping {agent.helpingScore}{" "}
                    · n={agent.prediction.totalCalls}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    FP {agent.prediction.falsePositives} · FN{" "}
                    {agent.prediction.falseNegatives} · calibration err{" "}
                    {agent.reasoning.confidenceCalibrationError}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">
              Close paper trades or resolve outcomes to grade agents.
            </p>
          )}
        </Panel>

        <Panel title="Agent Weaknesses">
          {report?.agentWeaknesses.length ? (
            <ul className="space-y-2 text-sm text-zinc-300">
              {report.agentWeaknesses.map((w, i) => (
                <li key={i} className="border-b border-zinc-800/60 pb-2">
                  <span
                    className={
                      w.severity === "high"
                        ? "text-rose-300"
                        : w.severity === "medium"
                          ? "text-amber-300"
                          : "text-zinc-400"
                    }
                  >
                    {w.agentName}
                  </span>
                  : {w.weakness} — {w.evidence}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No weaknesses flagged yet.</p>
          )}
        </Panel>

        <Panel title="Strategy Learning Report">
          {report?.strategyReports.length ? (
            <ul className="max-h-72 space-y-2 overflow-y-auto text-sm text-zinc-300">
              {report.strategyReports.map((s) => (
                <li key={s.strategyId} className="border-b border-zinc-800/60 pb-2">
                  <span className="text-teal-300">{s.label}</span> · hit{" "}
                  {s.hitRate}% · avg {s.avgPnlPct}% · n={s.sampleSize}
                  <br />
                  <span className="text-xs text-zinc-500">
                    Best regime {s.bestRegime ?? "—"} · worst {s.worstRegime ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No strategy signals resolved.</p>
          )}
        </Panel>

        <Panel title="Regime Learning Report">
          {report?.regimeReports.length ? (
            <ul className="max-h-72 space-y-2 overflow-y-auto text-sm text-zinc-300">
              {report.regimeReports.map((r) => (
                <li key={r.regime} className="border-b border-zinc-800/60 pb-2">
                  <span className="text-teal-300">{r.regime}</span> · hit{" "}
                  {r.hitRate}% · avg {r.avgPnlPct}% · n={r.sampleSize}
                  <br />
                  <span className="text-xs text-zinc-500">
                    Best {r.bestAgent ?? "—"} · worst {r.worstAgent ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No regime samples yet.</p>
          )}
        </Panel>

        <Panel title="Recent Evaluation Results">
          {report?.recentResults.length ? (
            <ul className="max-h-72 space-y-2 overflow-y-auto text-sm text-zinc-300">
              {report.recentResults.map((r) => (
                <li key={r.evaluationId} className="border-b border-zinc-800/60 pb-2">
                  <span className="font-mono text-xs text-zinc-500">
                    {r.decisionLogId.slice(0, 10)}
                  </span>{" "}
                  · {r.source} · PnL {r.pnlPct}% · {r.marketRegime}
                  {" · "}
                  <Link
                    href={`/trades/${encodeURIComponent(r.decisionLogId)}`}
                    className="text-cyan-400/90 hover:underline"
                  >
                    timeline
                  </Link>
                  <br />
                  <span className="text-xs text-zinc-500">
                    {r.tradeQuality
                      ? `Quality ${r.tradeQuality.grade} (${r.tradeQuality.compositeScore}) · `
                      : ""}
                    {r.improvementHints[0] ?? "No hints"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No evaluations stored.</p>
          )}
        </Panel>

        <Panel title="Recommendations for Improvement">
          {report?.improvementRecommendations.length ? (
            <ul className="space-y-3 text-sm">
              {report.improvementRecommendations.map((rec) => (
                <li
                  key={rec.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"
                >
                  <p className="font-medium text-zinc-100">{rec.title}</p>
                  <p className="mt-1 text-xs text-zinc-400">{rec.problem}</p>
                  <p className="mt-1 text-xs text-teal-300/90">{rec.suggestedAction}</p>
                  <p className="mt-1 text-[10px] text-zinc-500">
                    Adaptation hint: {rec.adaptationProposalHint} · confidence{" "}
                    {rec.confidence}%
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">Run evaluation to generate ideas.</p>
          )}
        </Panel>
      </div>
    </OpsShell>
  );
}
