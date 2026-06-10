"use client";

import type { IntegratedRiskBudgetSnapshot } from "@/lib/integrated-risk-budget/types";
import { RISK_BUDGET_SAFETY_NOTICE } from "@/lib/integrated-risk-budget/types";

const MODE_STYLE: Record<string, string> = {
  DEFENSIVE: "text-amber-300 border-amber-900/50 bg-amber-950/20",
  NORMAL: "text-emerald-300 border-emerald-900/50 bg-emerald-950/20",
  OPPORTUNITY: "text-cyan-300 border-cyan-900/50 bg-cyan-950/20",
  COOLDOWN: "text-rose-300 border-rose-900/50 bg-rose-950/20",
};

export function RiskBudgetBadge({
  riskBudget,
}: {
  riskBudget: IntegratedRiskBudgetSnapshot | null | undefined;
}) {
  const rec = riskBudget?.recommendation;
  if (!rec) return null;

  const style = MODE_STYLE[rec.mode] ?? MODE_STYLE.NORMAL;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${style}`}
      data-mvp="78"
      title={rec.reasons[0]}
    >
      Risk {rec.mode}
      <span className="opacity-70">· ${rec.recommendedMaxNotional}</span>
    </span>
  );
}

export function IntegratedRiskBudgetPanel({
  riskBudget,
  showApprovalNote = true,
}: {
  riskBudget: IntegratedRiskBudgetSnapshot | null | undefined;
  showApprovalNote?: boolean;
}) {
  const rec = riskBudget?.recommendation;
  const analysis = riskBudget?.analysis;
  if (!rec) {
    return <p className="text-sm text-zinc-500">Risk budget analysis loading…</p>;
  }

  return (
    <div className="space-y-4" data-mvp="78">
      <div>
        <p className="text-sm text-zinc-300">
          Mode <span className="font-mono text-violet-300">{rec.mode}</span> · recommended max
          notional{" "}
          <span className="font-mono">${rec.recommendedMaxNotional}</span>
          {rec.recommendedMaxNotional < rec.currentMaxNotional && (
            <span className="text-amber-300/90">
              {" "}
              (current cap ${rec.currentMaxNotional})
            </span>
          )}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Risk/trade {rec.recommendedRiskPerTrade}% · daily loss limit{" "}
          {rec.recommendedDailyLossLimit}% · max open {rec.recommendedMaxOpenPositions}
        </p>
      </div>

      {analysis && (
        <dl className="grid gap-2 text-[11px] sm:grid-cols-3">
          <div>
            <dt className="text-zinc-500">Evidence</dt>
            <dd className="font-mono text-zinc-300">
              {analysis.evidenceCompletedTrades}/{analysis.evidenceRequired}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Strategy health</dt>
            <dd className="font-mono text-zinc-300">
              {analysis.strategyHealthStatus ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Avg quality</dt>
            <dd className="font-mono text-zinc-300">
              {analysis.avgTradeQualityScore ?? "—"}
            </dd>
          </div>
        </dl>
      )}

      <ul className="space-y-1 text-xs text-zinc-400">
        {rec.reasons.map((r) => (
          <li key={r}>· {r}</li>
        ))}
      </ul>

      {showApprovalNote && rec.requiresApproval && (
        <p className="rounded border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-200/90">
          Human approval required to apply these limits in Settings — recommendations are not
          auto-applied. Live trading remains locked.
        </p>
      )}

      <p className="text-[10px] text-zinc-600">{RISK_BUDGET_SAFETY_NOTICE}</p>
    </div>
  );
}
