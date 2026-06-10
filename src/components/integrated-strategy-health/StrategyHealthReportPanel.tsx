"use client";

import type {
  IntegratedStrategyHealthSnapshot,
  StrategyHealthReport,
} from "@/lib/integrated-strategy-health/types";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-mono text-zinc-200">{value}</dd>
    </div>
  );
}

function ReportBlock({ report }: { report: StrategyHealthReport }) {
  return (
    <div className="mt-4 rounded-lg border border-zinc-800/80 bg-zinc-900/30 p-3">
      <p className="font-mono text-sm text-zinc-100">{report.strategyTag}</p>
      <p className="mt-1 text-xs text-zinc-400">
        Status {report.status} · {report.evidenceCount} evidence trades
      </p>
      <dl className="mt-3 grid gap-2 text-[11px] sm:grid-cols-3 lg:grid-cols-4">
        <Metric label="Win rate" value={`${report.winRate}%`} />
        <Metric label="Profit factor" value={String(report.profitFactor)} />
        <Metric label="Max drawdown" value={`$${report.maxDrawdown.toFixed(2)}`} />
        <Metric label="Net PnL" value={`$${report.netPnl.toFixed(2)}`} />
        <Metric label="Avg win" value={`$${report.avgWin.toFixed(2)}`} />
        <Metric label="Avg loss" value={`$${report.avgLoss.toFixed(2)}`} />
        <Metric label="Risk veto rate" value={`${(report.riskVetoRate * 100).toFixed(0)}%`} />
        <Metric label="Agent agreement" value={`${(report.agentTradeAgreementRate * 100).toFixed(0)}%`} />
      </dl>
      {report.biggestWeakness && (
        <p className="mt-2 text-xs text-rose-300/90">
          Biggest weakness: {report.biggestWeakness}
        </p>
      )}
      {report.bestPattern && (
        <p className="mt-1 text-xs text-emerald-300/90">
          Best pattern: {report.bestPattern}
        </p>
      )}
      <p className="mt-2 text-xs text-zinc-300">{report.recommendation}</p>
      <p className="mt-1 text-[11px] text-zinc-500">Next: {report.nextAction}</p>
      <p className="mt-2 text-[10px] text-zinc-600">
        {report.linkedTradeIds.length} trades · {report.linkedLearningRecordIds.length} learning
        records linked
      </p>
    </div>
  );
}

export default function StrategyHealthReportPanel({
  health,
  agentHealth,
}: {
  health: IntegratedStrategyHealthSnapshot | null | undefined;
  agentHealth?: import("@/lib/integrated-strategy-agent-health/types").IntegratedStrategyAgentHealthSnapshot | null;
}) {
  if (!health) {
    return (
      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <p className="text-sm text-zinc-500">Strategy health loading…</p>
      </section>
    );
  }

  const report = health.primaryReport;

  return (
    <section
      className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4"
      data-mvp="74"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-indigo-400/80">
            MVP 74 · {health.label}
          </p>
          <p className="mt-1 text-sm text-zinc-200">
            {health.evidenceReady
              ? "12-trade evidence complete — strategy health evaluated."
              : `${health.evidenceRequired - (report?.evidenceCount ?? 0)} more valid trades needed.`}
          </p>
        </div>
        {report && (
          <p className="text-xs font-semibold text-zinc-300">{report.status}</p>
        )}
      </div>

      {health.evidenceQualityBlocked && health.evidenceQualityBlockReason && (
        <p className="mt-3 rounded-lg border border-rose-900/40 bg-rose-950/20 px-3 py-2 text-xs text-rose-200">
          MVP 89 — Strategy health review blocked: {health.evidenceQualityBlockReason}
        </p>
      )}

      {agentHealth?.agentScoreboardV2.weakestAgent && (
        <p className="mt-3 rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
          MVP 91 — Weakest agent on testnet evidence:{" "}
          {agentHealth.agentScoreboardV2.weakestAgent}
          {agentHealth.agentScoreboardV2.topContributingAgent &&
            ` · Top contributor: ${agentHealth.agentScoreboardV2.topContributingAgent}`}
        </p>
      )}

      {health.registryRecommendation && (
        <p className="mt-3 rounded-lg border border-indigo-900/40 bg-indigo-950/20 px-3 py-2 text-xs text-indigo-200">
          Registry recommendation (advisory): {health.registryRecommendation.recommendation}
        </p>
      )}

      {health.governanceWarningActive && (
        <p className="mt-2 text-xs text-amber-300">
          Governance warning active — PAUSE/REJECT does not auto-change registry status.
        </p>
      )}

      {report ? (
        <ReportBlock report={report} />
      ) : health.evidenceQualityBlocked ? (
        <p className="mt-3 text-xs text-rose-300/90">
          Strategy health report withheld — fix evidence quality gaps before review.
        </p>
      ) : (
        <p className="mt-3 text-xs text-zinc-500">
          No strategy health report yet — close valid testnet trades with decisionLogId.
        </p>
      )}

      {health.reportsByTag.length > 1 && (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">
            By strategy tag
          </p>
          {health.reportsByTag
            .filter((r) => r.strategyTag !== report?.strategyTag)
            .map((r) => (
              <ReportBlock key={r.strategyTag} report={r} />
            ))}
        </div>
      )}

      <p className="mt-3 text-[10px] text-zinc-600">
        Agent scoreboard: {health.agentScoreboardLearned} learned · Live trading blocked · No
        auto strategy change · No risk increase.
      </p>
    </section>
  );
}
