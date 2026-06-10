"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { EngineActivationHealthResponse } from "@/lib/testnet-engine-activation/types";

const CLASS: Record<EngineActivationHealthResponse["status"], string> = {
  OK: "border-emerald-900/50 bg-emerald-950/20 text-emerald-100",
  WARNING: "border-amber-900/50 bg-amber-950/20 text-amber-100",
  BLOCKED: "border-rose-900/50 bg-rose-950/20 text-rose-100",
};

export default function EngineStatusBanner() {
  const [health, setHealth] = useState<EngineActivationHealthResponse | null>(null);

  useEffect(() => {
    void fetch("/api/analysis/health", { cache: "no-store" })
      .then((r) => r.json())
      .then(
        (data: EngineActivationHealthResponse & { ok?: boolean }) => {
          if (data.ok !== false && data.status) setHealth(data);
        },
      )
      .catch(() => setHealth(null));
  }, []);

  if (!health) return null;

  const detail =
    health.blockers[0] ??
    health.warnings[0] ??
    "All activation checks passed.";

  return (
    <Link
      href="/advanced/engine-health"
      className={`block rounded-xl border p-3 transition hover:opacity-90 ${CLASS[health.status]}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide opacity-80">Engine Health</p>
          <p className="text-sm font-semibold">{health.status}</p>
        </div>
        <span className="text-xs opacity-70">Details →</span>
      </div>
      <p className="mt-1 text-xs opacity-90">{detail}</p>
    </Link>
  );
}
