"use client";

import type { MissionControllerMode } from "@/lib/mission-controller/types";

const MODE_STYLE: Record<
  MissionControllerMode,
  { border: string; badge: string; label: string }
> = {
  NORMAL: {
    border: "border-sky-900/50",
    badge: "bg-sky-950/50 text-sky-200",
    label: "Normal",
  },
  OPPORTUNITY: {
    border: "border-emerald-900/50",
    badge: "bg-emerald-950/50 text-emerald-200",
    label: "Opportunity",
  },
  DEFENSIVE: {
    border: "border-amber-900/50",
    badge: "bg-amber-950/50 text-amber-200",
    label: "Defensive",
  },
  RECOVERY: {
    border: "border-violet-900/50",
    badge: "bg-violet-950/50 text-violet-200",
    label: "Recovery",
  },
  PAUSED: {
    border: "border-rose-900/50",
    badge: "bg-rose-950/50 text-rose-200",
    label: "Paused",
  },
};

type Props = {
  mode: MissionControllerMode;
  reason: string;
  nextAction: string;
  humanApprovalNeeded?: boolean;
  aiConfidence?: number | null;
  calibrationHeadline?: string | null;
  busy?: boolean;
};

export default function MissionControllerCard({
  mode,
  reason,
  nextAction,
  humanApprovalNeeded = false,
  aiConfidence = null,
  calibrationHeadline = null,
  busy = false,
}: Props) {
  const style = MODE_STYLE[mode];

  return (
    <section
      className={`rounded-xl border ${style.border} bg-gradient-to-br from-zinc-950/90 to-zinc-900/40 p-4`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Mission controller · $1k → $10k
        </p>
        <span
          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${style.badge}`}
        >
          {style.label}
          {busy ? " · …" : ""}
        </span>
      </div>

      <p className="text-sm font-medium text-zinc-100">{reason}</p>

      {aiConfidence != null && (
        <p className="mt-2 text-xs text-zinc-400">
          Calibrated AI confidence:{" "}
          <span className="font-mono text-zinc-200">{aiConfidence}/100</span>
          {calibrationHeadline && (
            <span className="block text-[10px] text-zinc-500">{calibrationHeadline}</span>
          )}
        </p>
      )}

      <div className="mt-3 rounded-lg border border-zinc-800/70 bg-zinc-950/50 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wide text-zinc-500">Next action</p>
        <p className="mt-1 text-xs text-zinc-300">{nextAction}</p>
        {humanApprovalNeeded && (
          <p className="mt-1 text-[10px] text-amber-400/90">Operator approval needed</p>
        )}
      </div>
    </section>
  );
}
