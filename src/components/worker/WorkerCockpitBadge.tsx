"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function WorkerCockpitBadge() {
  const [label, setLabel] = useState("Worker —");

  useEffect(() => {
    const refresh = async () => {
      try {
        const res = await fetch("/api/worker/status");
        const data = (await res.json()) as {
          ok: boolean;
          state?: {
            lastRun?: { status: string } | null;
            lastSuccessfulRunAt: string | null;
          };
          failedJobs?: unknown[];
          anomalySummary?: {
            criticalOpenCount: number;
            blocksRiskyActions: boolean;
          };
          backboneHealthy?: boolean;
        };
        if (!data.ok || !data.state) return;
        const status = data.state.lastRun?.status ?? "IDLE";
        const failed = data.failedJobs?.length ?? 0;
        const backbone = data.backboneHealthy ? "" : " · backbone check";
        const incidents =
          data.anomalySummary?.criticalOpenCount && data.anomalySummary.criticalOpenCount > 0
            ? ` · ${data.anomalySummary.criticalOpenCount} critical`
            : "";
        const blocked = data.anomalySummary?.blocksRiskyActions
          ? " · actions blocked"
          : "";
        setLabel(
          `Worker ${status}${failed > 0 ? ` · ${failed} failed` : ""}${incidents}${blocked}${backbone}`,
        );
      } catch {
        setLabel("Worker offline");
      }
    };
    void refresh();
    const id = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Link
      href="/worker"
      className="rounded-lg border border-cyan-900/50 bg-cyan-950/30 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-900/30"
    >
      {label}
    </Link>
  );
}
