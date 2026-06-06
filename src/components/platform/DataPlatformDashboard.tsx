"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import DataHealthPanel from "@/components/data-backbone/DataHealthPanel";
import { loadDeskBackbone } from "@/lib/data-backbone/read-desk-state";

export default function DataPlatformDashboard() {
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [stale, setStale] = useState<string | null>(null);

  useEffect(() => {
    const bb = loadDeskBackbone();
    setHealthy(bb.health.healthy);
    setStale(bb.health.staleWarning);
  }, []);

  return (
    <OpsShell
      badge="P-MVP 6 · Platform data"
      title="Data"
      subtitle="Desk data health and sync — operator view, not raw storage."
      accent="cyan"
      iconLetters="DT"
      activePath="/data"
      nav={[
        { href: "/", label: "← Cockpit" },
        { href: "/warehouse", label: "Warehouse" },
        { href: "/ledger", label: "Ledger" },
      ]}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <OpsKpi
          label="Backbone"
          value={healthy == null ? "—" : healthy ? "Healthy" : "Needs attention"}
          hint="Unified desk read path"
        />
        <OpsKpi label="Stale warning" value={stale ? "Yes" : "No"} hint="Data freshness" />
        <OpsKpi label="Live data" value="Locked" hint="Paper learning only" />
      </div>

      <section className="desk-panel px-4 py-4">
        <h2 className="text-sm font-semibold text-zinc-100">Data health</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Technical storage details are here for operators who need them — not on the main cockpit.
        </p>
        <div className="mt-4">
          <DataHealthPanel health={loadDeskBackbone().health} />
        </div>
      </section>

      <section className="desk-panel px-4 py-4 text-xs text-zinc-400">
        <p>
          For warehouse migrations and raw tables, open{" "}
          <Link href="/warehouse" className="text-cyan-400 hover:underline">
            Warehouse
          </Link>
          . Trading history is on{" "}
          <Link href="/ledger" className="text-indigo-400 hover:underline">
            Ledger
          </Link>
          .
        </p>
      </section>
    </OpsShell>
  );
}
