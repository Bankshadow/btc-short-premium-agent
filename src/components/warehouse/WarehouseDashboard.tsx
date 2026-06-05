"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import { pushWarehouseMigrateLocal } from "@/lib/db/client-warehouse-sync";
import { compareStorageSources } from "@/lib/db/storage-comparison";
import { WAREHOUSE_SAFETY_NOTICE } from "@/lib/db/types";
import type { DbStatusReport, WarehouseSnapshot } from "@/lib/db/types";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadLivePilotJournal } from "@/lib/live-pilot/journal-store";
import { loadPaperOrders } from "@/lib/paper/paper-orders";

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function WarehouseDashboard() {
  const [status, setStatus] = useState<DbStatusReport | null>(null);
  const [snapshot, setSnapshot] = useState<WarehouseSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [migrateMsg, setMigrateMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const local = {
        decisionLogs: loadDecisionLog().length,
        paperTrades: loadPaperOrders().length,
        liveTrades: loadLivePilotJournal().length,
      };
      const [statusRes, snapRes] = await Promise.all([
        fetch("/api/db/status", { cache: "no-store" }),
        fetch(
          `/api/warehouse/snapshot?decisionLogs=${local.decisionLogs}&paperTrades=${local.paperTrades}&liveTrades=${local.liveTrades}`,
          { cache: "no-store" },
        ),
      ]);
      const statusData = await statusRes.json();
      const snapData = await snapRes.json();
      if (!statusRes.ok) throw new Error(statusData.error ?? "Status failed");
      setStatus(statusData.report as DbStatusReport);
      setSnapshot(snapData.snapshot as WarehouseSnapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runMigrate = async () => {
    setBusy(true);
    setMigrateMsg(null);
    setError(null);
    const result = await pushWarehouseMigrateLocal();
    if (!result.ok) {
      setError(result.error ?? "Migration failed");
    } else {
      setMigrateMsg("Migration complete — localStorage preserved.");
      await refresh();
    }
    setBusy(false);
  };

  const comparison =
    status && snapshot
      ? compareStorageSources({
          decisionLogsLocal: loadDecisionLog().length,
          decisionLogsWarehouse: snapshot.counts.decision_logs,
          paperTradesLocal: loadPaperOrders().length,
          paperTradesWarehouse: snapshot.counts.paper_trades,
          liveTradesLocal: loadLivePilotJournal().length,
          liveTradesWarehouse: snapshot.counts.live_trades,
        })
      : [];

  return (
    <OpsShell
      badge="MVP 41 · Data warehouse"
      title="Production Data Warehouse"
      subtitle="Database-backed source of truth — localStorage is UI cache only."
      accent="indigo"
      iconLetters="WH"
      activePath="/warehouse"
      nav={[
        { href: "/", label: "← Desk" },
        { href: "/command-center", label: "Command" },
        { href: "/governance", label: "Governance", primary: true },
      ]}
    >
      <p className="rounded-lg border border-indigo-900/40 bg-indigo-950/20 px-4 py-2 text-xs text-indigo-200/90">
        {WAREHOUSE_SAFETY_NOTICE}
      </p>

      {status && (
        <div className="grid gap-3 sm:grid-cols-4">
          <OpsKpi label="Backend" value={status.backend.toUpperCase()} hint="supabase or file" />
          <OpsKpi
            label="Source of truth"
            value={status.sourceOfTruth === "warehouse" ? "DB" : "LOCAL"}
            hint={status.configured ? "configured" : "off"}
          />
          <OpsKpi
            label="Decision logs"
            value={String(status.tables.decision_logs.count)}
            hint="warehouse"
          />
          <OpsKpi
            label="Live blocked"
            value={status.liveExecutionBlocked ? "YES" : "no"}
            hint="write health"
          />
        </div>
      )}

      {error && (
        <p className="rounded border border-rose-900/50 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      )}
      {migrateMsg && (
        <p className="rounded border border-emerald-900/40 px-3 py-2 text-xs text-emerald-300">
          {migrateMsg}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
        >
          Refresh
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void runMigrate()}
          className="rounded bg-indigo-800/70 px-3 py-1.5 text-xs text-indigo-100 hover:bg-indigo-700/70 disabled:opacity-50"
        >
          Migrate local → warehouse
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Data Health">
          {status ? (
            <ul className="space-y-1 text-xs text-zinc-400">
              <li>Backend: {status.backend}</li>
              <li>Live execution blocked: {String(status.liveExecutionBlocked)}</li>
              {status.liveBlockReason && (
                <li className="text-rose-400">{status.liveBlockReason}</li>
              )}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">Loading…</p>
          )}
        </Panel>

        <Panel title="Sync Status">
          {snapshot ? (
            <p className="text-xs text-zinc-400">{snapshot.migrationHint}</p>
          ) : (
            <p className="text-xs text-zinc-500">—</p>
          )}
        </Panel>

        <Panel title="Last Writes">
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-zinc-500">
            {(snapshot?.lastWrites ?? []).map((w) => (
              <li key={w.domain}>
                {w.domain}: {w.lastOkAt ?? "never"}
                {w.lastError ? ` · err ${w.lastError.slice(0, 40)}` : ""}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Missing Records">
          {snapshot && snapshot.missingRecords.length === 0 ? (
            <p className="text-xs text-emerald-400/90">No gaps detected.</p>
          ) : (
            <ul className="text-xs text-amber-300/90">
              {snapshot?.missingRecords.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Migration Status">
          <p className="text-xs text-zinc-400">
            POST /api/db/migrate-local copies browser cache to warehouse without
            deleting localStorage.
          </p>
          <Link
            href="/api/warehouse/decision-logs"
            className="mt-2 inline-block text-xs text-indigo-400 hover:underline"
          >
            API: warehouse decision logs →
          </Link>
        </Panel>

        <Panel title="Storage Source Comparison">
          <table className="w-full text-xs text-zinc-400">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="py-1">Domain</th>
                <th>Local</th>
                <th>Warehouse</th>
                <th>OK</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((c) => (
                <tr key={c.domain}>
                  <td className="py-1">{c.domain}</td>
                  <td>{c.localCount}</td>
                  <td>{c.warehouseCount}</td>
                  <td className={c.inSync ? "text-emerald-400" : "text-amber-400"}>
                    {c.inSync ? "yes" : "migrate"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      {status && (
        <Panel title="Table counts">
          <div className="grid gap-2 sm:grid-cols-3 text-xs text-zinc-500">
            {Object.entries(status.tables).map(([table, { count }]) => (
              <div key={table}>
                {table}: {count}
              </div>
            ))}
          </div>
        </Panel>
      )}
    </OpsShell>
  );
}
