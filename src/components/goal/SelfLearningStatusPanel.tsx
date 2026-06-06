"use client";

import Link from "next/link";
import type { MissionFlowSelfLearning } from "@/lib/mission-flow/types";

export default function SelfLearningStatusPanel({
  selfLearning,
  compact = false,
}: {
  selfLearning: MissionFlowSelfLearning;
  compact?: boolean;
}) {
  if (selfLearning.serverEvaluated === 0 && !selfLearning.lastTopAgent) return null;

  return (
    <section
      className={
        compact
          ? "rounded-lg border border-indigo-900/30 bg-indigo-950/10 p-3"
          : "rounded-xl border border-indigo-900/40 bg-indigo-950/15 p-5"
      }
    >
      <p className="text-xs uppercase tracking-wide text-indigo-300/80">Self-learning</p>
      <p className="mt-1 text-sm text-zinc-200">
        {selfLearning.serverEvaluated} server evaluation(s)
        {selfLearning.lastTopAgent ? ` · top agent ${selfLearning.lastTopAgent}` : ""}
      </p>
      {selfLearning.lastEvaluatedAt && (
        <p className="mt-1 text-[11px] text-zinc-500">
          Last eval {new Date(selfLearning.lastEvaluatedAt).toLocaleString()}
        </p>
      )}
      <Link href="/learning" className="mt-2 inline-block text-xs text-emerald-300 hover:underline">
        Full learning dashboard →
      </Link>
    </section>
  );
}
