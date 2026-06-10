"use client";

import type { MicroLiveReadinessSnapshot } from "@/lib/micro-live-readiness/types";

const STATUS_STYLE: Record<string, string> = {
  READY_FOR_REVIEW: "text-emerald-300 border-emerald-900/50 bg-emerald-950/20",
  NOT_READY: "text-amber-300 border-amber-900/50 bg-amber-950/20",
  BLOCKED: "text-rose-300 border-rose-900/50 bg-rose-950/20",
};

export default function MicroLiveReadinessBadge({
  readiness,
}: {
  readiness: MicroLiveReadinessSnapshot | null | undefined;
}) {
  if (!readiness) return null;

  const style =
    STATUS_STYLE[readiness.readinessStatus] ?? STATUS_STYLE.NOT_READY;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${style}`}
      data-mvp="75"
      title="Micro-live review readiness — live trading stays locked"
    >
      Micro-live {readiness.readinessStatus.replace(/_/g, " ")}
      <span className="opacity-70">· {readiness.readinessScore}%</span>
    </span>
  );
}
