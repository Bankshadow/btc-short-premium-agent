"use client";

import type { IntegratedStrategyHealthSnapshot } from "@/lib/integrated-strategy-health/types";

const STATUS_STYLE: Record<string, string> = {
  CONTINUE: "text-emerald-300 border-emerald-900/50 bg-emerald-950/20",
  REDUCE_RISK: "text-amber-300 border-amber-900/50 bg-amber-950/20",
  NEEDS_MORE_DATA: "text-zinc-300 border-zinc-700/60 bg-zinc-900/40",
  PAUSE: "text-rose-300 border-rose-900/50 bg-rose-950/20",
  REJECT: "text-rose-300 border-rose-900/50 bg-rose-950/20",
};

export default function StrategyHealthBadge({
  health,
}: {
  health: IntegratedStrategyHealthSnapshot | null | undefined;
}) {
  const report = health?.primaryReport;
  if (!report) return null;

  const style = STATUS_STYLE[report.status] ?? STATUS_STYLE.NEEDS_MORE_DATA;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${style}`}
      data-mvp="74"
    >
      Strategy {report.status.replace(/_/g, " ")}
      <span className="opacity-70">
        · {report.evidenceCount}/{health?.evidenceRequired ?? 12}
      </span>
    </span>
  );
}
