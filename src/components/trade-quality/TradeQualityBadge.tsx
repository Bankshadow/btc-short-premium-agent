"use client";

import type { IntegratedTradeQualitySnapshot } from "@/lib/trade-quality-score/types";

function gradeClass(grade: string | null | undefined): string {
  if (grade === "A") return "text-emerald-300 border-emerald-900/50 bg-emerald-950/20";
  if (grade === "B") return "text-teal-300 border-teal-900/50 bg-teal-950/20";
  if (grade === "C") return "text-amber-300 border-amber-900/50 bg-amber-950/20";
  if (grade === "D") return "text-orange-300 border-orange-900/50 bg-orange-950/20";
  if (grade === "F") return "text-rose-300 border-rose-900/50 bg-rose-950/20";
  return "text-zinc-300 border-zinc-700/60 bg-zinc-900/40";
}

export default function TradeQualityBadge({
  quality,
}: {
  quality: IntegratedTradeQualitySnapshot | null | undefined;
}) {
  const summary = quality?.summary;
  if (!summary || summary.sampleCount === 0) return null;

  const avgGrade = summary.avgGrade ?? "—";
  const style = gradeClass(summary.avgGrade ?? undefined);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${style}`}
      data-mvp="76"
      title={`Avg quality ${summary.avgCompositeScore}/100 · ${summary.testnetScoredCount ?? 0} testnet scored`}
    >
      Quality {avgGrade}
      <span className="opacity-70">· {summary.avgCompositeScore}/100</span>
    </span>
  );
}
