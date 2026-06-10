"use client";

import type { MissionFlowSnapshot } from "@/lib/mission-flow/types";

const MODE_STYLE: Record<string, string> = {
  PAUSED: "border-rose-900/50 bg-rose-950/30 text-rose-200",
  COOLDOWN: "border-orange-900/50 bg-orange-950/20 text-orange-200",
  DEFENSIVE: "border-amber-900/50 bg-amber-950/20 text-amber-200",
  NORMAL: "border-emerald-900/50 bg-emerald-950/20 text-emerald-200",
  OPPORTUNITY: "border-cyan-900/50 bg-cyan-950/20 text-cyan-200",
  NOT_READY: "border-zinc-700 bg-zinc-900/60 text-zinc-300",
  READY_FOR_REVIEW: "border-emerald-900/50 bg-emerald-950/20 text-emerald-200",
  BLOCKED: "border-rose-900/50 bg-rose-950/30 text-rose-200",
};

function Badge({
  label,
  value,
  modeKey,
  title,
}: {
  label: string;
  value: string;
  modeKey: string;
  title?: string | null;
}) {
  const style = MODE_STYLE[modeKey] ?? MODE_STYLE.NORMAL;
  return (
    <span
      className={`inline-flex flex-col gap-0.5 rounded-lg border px-2.5 py-1.5 text-[10px] ${style}`}
      title={title ?? undefined}
    >
      <span className="uppercase tracking-wide opacity-70">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

/** MVP 95 — separate mission / risk budget / readiness labels (no mixing). */
export function MissionModeLabels({
  snapshot,
}: {
  snapshot: MissionFlowSnapshot;
}) {
  const mcr = snapshot.missionControllerRiskBudget;
  const riskMode = snapshot.integratedRiskBudget?.recommendation.mode ?? "NORMAL";
  const review = snapshot.microLiveReadinessReview;
  const readinessLabel =
    review.readinessStatus === "READY_FOR_REVIEW"
      ? `READY ${review.readinessScore}%`
      : review.readinessStatus === "BLOCKED"
        ? `BLOCKED ${review.readinessScore}%`
        : `NOT READY ${review.readinessScore}%`;

  return (
    <div className="flex flex-wrap gap-2" data-mvp="95">
      <Badge
        label="Mission mode"
        value={mcr.missionMode}
        modeKey={mcr.missionMode}
        title={mcr.modeReason}
      />
      <Badge
        label="Risk budget mode"
        value={riskMode}
        modeKey={riskMode}
        title={snapshot.integratedRiskBudget?.recommendation.reasons[0] ?? undefined}
      />
      <Badge
        label="Readiness"
        value={readinessLabel}
        modeKey={review.readinessStatus}
        title={review.topBlocker ?? undefined}
      />
    </div>
  );
}
