"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import IncidentsV2Badge from "@/components/incidents-v2/IncidentsV2Badge";
import { loadLedgerAnalyticsInput } from "@/lib/ledger/analytics";
import type {
  LedgerEntry,
  LedgerEnvironment,
  TradeLifecycleStage,
} from "@/lib/ledger/types";

const ENVIRONMENTS: Array<LedgerEnvironment | "ALL"> = [
  "ALL",
  "DEMO",
  "PAPER",
  "SHADOW",
  "TESTNET",
  "LIVE",
];

const LIFECYCLES: Array<TradeLifecycleStage | "ALL"> = [
  "ALL",
  "SIGNAL",
  "PREVIEW",
  "APPROVED",
  "OPENED",
  "MONITORING",
  "CLOSE_RECOMMENDED",
  "CLOSED",
  "RESOLVED",
  "LEARNED",
];

function envBadge(env: string): string {
  const map: Record<string, string> = {
    DEMO: "text-zinc-400",
    PAPER: "text-sky-300",
    SHADOW: "text-violet-300",
    TESTNET: "text-cyan-300",
    LIVE: "text-rose-300",
  };
  return map[env] ?? "text-zinc-400";
}

function kindBadge(kind: string): string {
  const map: Record<string, string> = {
    DECISION: "bg-indigo-900/40 text-indigo-200",
    TRADE: "bg-emerald-900/40 text-emerald-200",
    ORDER: "bg-sky-900/40 text-sky-200",
    PNL: "bg-amber-900/40 text-amber-200",
    APPROVAL: "bg-violet-900/40 text-violet-200",
    RISK: "bg-rose-900/40 text-rose-200",
    AUDIT: "bg-zinc-800 text-zinc-300",
    CORRECTION: "bg-orange-900/40 text-orange-200",
  };
  return map[kind] ?? "bg-zinc-800 text-zinc-300";
}

export default function LedgerDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [envFilter, setEnvFilter] = useState<LedgerEnvironment | "ALL">("ALL");
  const [assetFilter, setAssetFilter] = useState("");
  const [strategyFilter, setStrategyFilter] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState<TradeLifecycleStage | "ALL">(
    "ALL",
  );
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);

  const { ledger, entries, orders } = useMemo(() => {
    void refreshKey;
    const input = loadLedgerAnalyticsInput();
    return {
      ledger: input.ledger,
      entries: input.entries,
      orders: input.orders,
    };
  }, [refreshKey]);

  const assets = useMemo(() => {
    const set = new Set<string>();
    for (const e of ledger.entries) {
      if (e.asset) set.add(e.asset);
    }
    return [...set].sort();
  }, [ledger.entries]);

  const strategies = useMemo(() => {
    const set = new Set<string>();
    for (const e of ledger.entries) {
      if (e.strategy) set.add(e.strategy);
    }
    return [...set].sort();
  }, [ledger.entries]);

  const filteredEntries = useMemo(() => {
    return ledger.entries.filter((e) => {
      if (envFilter !== "ALL" && e.environment !== envFilter) return false;
      if (assetFilter && e.asset !== assetFilter) return false;
      if (strategyFilter && e.strategy !== strategyFilter) return false;
      if (lifecycleFilter !== "ALL" && e.lifecycleStage !== lifecycleFilter) {
        return false;
      }
      return true;
    });
  }, [ledger.entries, envFilter, assetFilter, strategyFilter, lifecycleFilter]);

  const selectedTimeline = useMemo(() => {
    if (!selectedTradeId) return null;
    return (
      ledger.tradeTimelines.find((t) => t.tradeId === selectedTradeId) ?? null
    );
  }, [ledger.tradeTimelines, selectedTradeId]);

  return (
    <OpsShell
      badge="P-MVP 3 · Unified ledger"
      title="Trading Ledger"
      subtitle="Single source of truth linking decisions, orders, trades, risk, approvals, PnL, and learning."
      accent="indigo"
      iconLetters="LG"
      activePath="/ledger"
      nav={[
        { href: "/", label: "← Desk" },
        { href: "/portfolio", label: "Portfolio" },
        { href: "/validation", label: "Validation" },
      ]}
      actions={
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          className="rounded-lg bg-indigo-700/90 px-4 py-2 text-xs font-semibold text-zinc-100"
        >
          Sync ledger
        </button>
      }
    >
      <p
        className={`rounded-lg border px-4 py-2 text-xs ${
          ledger.health.healthy
            ? "border-emerald-900/40 bg-emerald-950/20 text-emerald-200/90"
            : "border-rose-900/40 bg-rose-950/20 text-rose-200/90"
        }`}
      >
        Ledger {ledger.health.healthy ? "healthy" : "UNHEALTHY"} ·{" "}
        {ledger.health.entryCount} entries · {entries.length} decisions ·{" "}
        {orders.length} paper orders · live entries append-only
      </p>
      <div className="flex flex-wrap gap-2">
        <IncidentsV2Badge />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OpsKpi
          label="Entries"
          value={String(ledger.health.entryCount)}
          hint={`${ledger.tradeTimelines.length} trade timelines`}
        />
        <OpsKpi
          label="Live entries"
          value={String(ledger.health.liveEntryCount)}
          hint="Append-only"
        />
        <OpsKpi
          label="Orphan trades"
          value={String(ledger.health.orphanTrades)}
          hint="Missing decision link"
        />
        <OpsKpi
          label="Last sync"
          value={
            ledger.health.lastSyncedAt
              ? new Date(ledger.health.lastSyncedAt).toLocaleTimeString()
              : "—"
          }
          hint={ledger.workspaceId}
        />
      </div>

      <section className="desk-panel px-4 py-4">
        <h2 className="text-sm font-semibold text-zinc-100">Filters</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <label className="text-xs text-zinc-500">
            Environment
            <select
              value={envFilter}
              onChange={(e) =>
                setEnvFilter(e.target.value as LedgerEnvironment | "ALL")
              }
              className="mt-1 block rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-200"
            >
              {ENVIRONMENTS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-500">
            Asset
            <select
              value={assetFilter}
              onChange={(e) => setAssetFilter(e.target.value)}
              className="mt-1 block rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-200"
            >
              <option value="">All</option>
              {assets.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-500">
            Strategy
            <select
              value={strategyFilter}
              onChange={(e) => setStrategyFilter(e.target.value)}
              className="mt-1 block rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-200"
            >
              <option value="">All</option>
              {strategies.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-500">
            Lifecycle
            <select
              value={lifecycleFilter}
              onChange={(e) =>
                setLifecycleFilter(e.target.value as TradeLifecycleStage | "ALL")
              }
              className="mt-1 block rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-200"
            >
              {LIFECYCLES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="desk-panel max-h-[520px] overflow-y-auto px-4 py-4">
          <h2 className="text-sm font-semibold text-zinc-100">
            Ledger entries ({filteredEntries.length})
          </h2>
          <ul className="mt-3 space-y-2">
            {filteredEntries.length === 0 && (
              <li className="text-xs text-zinc-500">No entries match filters.</li>
            )}
            {filteredEntries.slice(0, 80).map((e) => (
              <LedgerRow
                key={e.ledgerEntryId}
                entry={e}
                selected={selectedTradeId === (e.linkedTradeId ?? e.linkedDecisionId)}
                onSelect={() =>
                  setSelectedTradeId(e.linkedTradeId ?? e.linkedDecisionId ?? null)
                }
              />
            ))}
          </ul>
        </section>

        <section className="desk-panel px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-100">Linked event timeline</h2>
            {selectedTimeline && (
              <Link
                href={`/trades/${encodeURIComponent(selectedTimeline.tradeId)}`}
                className="rounded border border-indigo-800/50 px-2 py-1 text-[10px] text-indigo-300 hover:bg-indigo-950/40"
              >
                Open full lifecycle
              </Link>
            )}
          </div>
          {!selectedTimeline ? (
            <p className="mt-2 text-xs text-zinc-500">
              Select an entry to view SIGNAL → LEARNED lifecycle chain.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-zinc-400">
                Trade <span className="font-mono text-zinc-200">{selectedTimeline.tradeId}</span>{" "}
                · <span className={envBadge(selectedTimeline.environment)}>
                  {selectedTimeline.environment}
                </span>{" "}
                · stage{" "}
                <span className="text-amber-300">{selectedTimeline.currentStage}</span>
              </p>
              <ol className="relative border-l border-zinc-800 pl-4">
                {selectedTimeline.events.map((ev) => (
                  <li key={ev.ledgerEntryId} className="mb-4 ml-1">
                    <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-indigo-600" />
                    <p className="text-[10px] text-zinc-500">
                      {new Date(ev.timestamp).toLocaleString()}
                    </p>
                    <p className="text-xs text-zinc-200">
                      <span
                        className={`mr-2 rounded px-1 py-0.5 text-[10px] ${kindBadge(ev.entryKind)}`}
                      >
                        {ev.entryKind}
                      </span>
                      {ev.lifecycleStage ?? "—"} · {ev.sourceType}
                    </p>
                    {ev.linkedDecisionId && (
                      <p className="font-mono text-[10px] text-zinc-600">
                        decision {ev.linkedDecisionId.slice(0, 12)}…
                      </p>
                    )}
                  </li>
                ))}
              </ol>
              <Link
                href="/"
                className="text-[10px] text-indigo-400 hover:underline"
              >
                Open linked decision on desk →
              </Link>
            </div>
          )}
        </section>
      </div>

      {!ledger.health.healthy && ledger.health.issues.length > 0 && (
        <section className="desk-panel border-rose-900/40 px-4 py-4">
          <h2 className="text-sm font-semibold text-rose-300">Integrity issues</h2>
          <ul className="mt-2 space-y-1 text-xs text-rose-200/80">
            {ledger.health.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-zinc-500">
            Corrections create new CORRECTION entries — live rows are never mutated.
          </p>
        </section>
      )}
    </OpsShell>
  );
}

function LedgerRow({
  entry,
  selected,
  onSelect,
}: {
  entry: LedgerEntry;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`w-full rounded-lg border px-3 py-2 text-left transition ${
          selected
            ? "border-indigo-700 bg-indigo-950/30"
            : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-[10px] ${kindBadge(entry.entryKind)}`}>
            {entry.entryKind}
          </span>
          <span className={`text-[10px] font-semibold ${envBadge(entry.environment)}`}>
            {entry.environment}
          </span>
          {entry.lifecycleStage && (
            <span className="text-[10px] text-amber-400/90">{entry.lifecycleStage}</span>
          )}
          <span className="text-[10px] text-zinc-600">{entry.sourceType}</span>
        </div>
        <p className="mt-1 text-xs text-zinc-300">
          {entry.asset ?? "—"} · {entry.strategy ?? "desk"}
        </p>
        <p className="font-mono text-[10px] text-zinc-600">
          {new Date(entry.timestamp).toLocaleString()} · {entry.ledgerEntryId.slice(0, 24)}…
        </p>
      </button>
    </li>
  );
}
