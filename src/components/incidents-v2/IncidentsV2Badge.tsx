"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type BadgeState = {
  openCount: number;
  criticalOpenCount: number;
  blocksRiskyActions: boolean;
};

export default function IncidentsV2Badge({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<BadgeState>({
    openCount: 0,
    criticalOpenCount: 0,
    blocksRiskyActions: false,
  });

  useEffect(() => {
    const refresh = async () => {
      try {
        const res = await fetch("/api/incidents-v2", { cache: "no-store" });
        const data = (await res.json()) as {
          ok: boolean;
          summary?: {
            openCount: number;
            criticalOpenCount: number;
            blocksRiskyActions: boolean;
          };
        };
        if (!res.ok || !data.ok || !data.summary) return;
        setState({
          openCount: data.summary.openCount,
          criticalOpenCount: data.summary.criticalOpenCount,
          blocksRiskyActions: data.summary.blocksRiskyActions,
        });
      } catch {
        /* keep previous state */
      }
    };

    void refresh();
    const id = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Link
      href="/incidents-v2"
      className={`rounded-lg border px-3 py-1.5 text-xs ${
        state.blocksRiskyActions
          ? "border-rose-900/50 bg-rose-950/30 text-rose-200 hover:bg-rose-900/30"
          : "border-zinc-700 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-800/50"
      }`}
    >
      {compact ? "Incidents V2" : "Incidents V2"}
      {` · ${state.openCount} open`}
      {state.criticalOpenCount > 0 ? ` · ${state.criticalOpenCount} critical` : ""}
      {state.blocksRiskyActions ? " · actions blocked" : ""}
    </Link>
  );
}
