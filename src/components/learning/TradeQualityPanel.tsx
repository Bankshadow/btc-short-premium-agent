"use client";

import Link from "next/link";
import type { TradeQualityScore, TradeQualitySummary } from "@/lib/trade-quality-score/types";
import { TRADE_QUALITY_SAFETY_NOTICE } from "@/lib/trade-quality-score/types";
import { DIMENSION_LABELS } from "@/lib/trade-quality-score/config";

function gradeClass(grade: string): string {
  if (grade === "A") return "text-emerald-300";
  if (grade === "B") return "text-teal-300";
  if (grade === "C") return "text-amber-300";
  if (grade === "D") return "text-orange-300";
  return "text-rose-300";
}

function ScoreRow({ score }: { score: TradeQualityScore }) {
  return (
    <li className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`text-lg font-bold ${gradeClass(score.grade)}`}>{score.grade}</span>
        <span className="font-mono text-zinc-500">{score.compositeScore}/100</span>
        <span className="text-zinc-500">
          PnL {score.pnlPct}% · {score.source}
        </span>
      </div>
      <p className="mt-1 text-zinc-400">{score.primaryReason}</p>
      {score.improvements[0] && (
        <p className="mt-1 text-zinc-500">Improve: {score.improvements[0]}</p>
      )}
      <Link
        href={`/trades/${encodeURIComponent(score.decisionLogId)}`}
        className="mt-1 inline-block text-cyan-400/90 hover:underline"
      >
        View trade timeline →
      </Link>
    </li>
  );
}

export default function TradeQualityPanel({
  summary,
  busy,
  onRecompute,
}: {
  summary: TradeQualitySummary | null;
  busy?: boolean;
  onRecompute?: () => void;
}) {
  if (!summary || summary.sampleCount === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-400">
          Trade quality grades decision process across setup, entry, risk/reward, execution, exit,
          rules, and AI reasoning — not PnL alone.
        </p>
        {onRecompute && (
          <button
            type="button"
            disabled={busy}
            onClick={onRecompute}
            className="rounded-lg border border-indigo-800/60 px-3 py-1.5 text-xs text-indigo-200 hover:bg-indigo-950/40 disabled:opacity-50"
          >
            {busy ? "..." : "Score resolved trades"}
          </button>
        )}
        <p className="text-[10px] text-zinc-600">{TRADE_QUALITY_SAFETY_NOTICE}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-300">{summary.headline}</p>
          {summary.weakestDimension && (
            <p className="mt-1 text-xs text-zinc-500">
              Weakest dimension: {DIMENSION_LABELS[summary.weakestDimension]}
            </p>
          )}
        </div>
        {onRecompute && (
          <button
            type="button"
            disabled={busy}
            onClick={onRecompute}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900/60 disabled:opacity-50"
          >
            {busy ? "..." : "Recompute"}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 text-[10px]">
        {(["A", "B", "C", "D", "F"] as const).map((g) => (
          <span key={g} className={`rounded border border-zinc-800 px-2 py-0.5 ${gradeClass(g)}`}>
            {g}: {summary.gradeCounts[g]}
          </span>
        ))}
      </div>

      <ul className="space-y-2">
        {summary.recent.map((s) => (
          <ScoreRow key={s.scoreId} score={s} />
        ))}
      </ul>

      <p className="text-[10px] text-zinc-600">{TRADE_QUALITY_SAFETY_NOTICE}</p>
    </div>
  );
}
