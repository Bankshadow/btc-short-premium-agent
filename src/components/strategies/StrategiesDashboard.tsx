"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadDeskBackboneInputs } from "@/lib/data-backbone/read-desk-state";
import DataHealthPanel from "@/components/data-backbone/DataHealthPanel";
import { loadDraftRules } from "@/lib/journal/draft-rules";
import {
  buildStrategyRegistry,
  getStrategyById,
} from "@/lib/strategy-registry/build-strategy-registry";
import {
  demoteStrategy,
  disableStrategy,
  linkDraftRuleToStrategy,
  promoteStrategy,
  unlinkDraftRuleFromStrategy,
  unlockAutoStatus,
} from "@/lib/strategy-registry/strategy-registry-actions";
import type {
  StrategyRegistryStatus,
  StrategySkill,
} from "@/lib/strategy-registry/strategy-registry-types";
import type { StrategyRegistryHealthRecommendation } from "@/lib/integrated-strategy-health/types";
import type { StrategyId } from "@/lib/validation/validation-types";
import { REGIME_ROUTER_RULES } from "@/lib/validation/regime-router";

function statusClass(status: StrategyRegistryStatus): string {
  const map: Record<StrategyRegistryStatus, string> = {
    ACTIVE: "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30",
    PAPER_TESTING: "bg-sky-500/20 text-sky-200 ring-sky-500/30",
    WATCHLIST: "bg-amber-500/20 text-amber-200 ring-amber-500/30",
    DRAFT: "bg-zinc-500/20 text-zinc-300 ring-zinc-500/30",
    DISABLED: "bg-rose-500/20 text-rose-300 ring-rose-500/30",
    DEPRECATED: "bg-zinc-700/40 text-zinc-500 ring-zinc-600/30",
  };
  return `inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ring-1 ${map[status]}`;
}

export default function StrategiesDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedId, setSelectedId] = useState<StrategyId | null>(null);
  const [linkRuleId, setLinkRuleId] = useState("");
  const [healthRecs, setHealthRecs] = useState<StrategyRegistryHealthRecommendation[]>(
    [],
  );

  useEffect(() => {
    void fetch("/api/integrated-strategy-health", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (json.ok && Array.isArray(json.registryRecommendations)) {
          setHealthRecs(json.registryRecommendations);
        }
      })
      .catch(() => undefined);
  }, [refreshKey]);

  const { record, productionEntries, productionOrders, riskProfile } = useMemo(() => {
    void refreshKey;
    const input = loadDeskBackboneInputs();
    return {
      record: input.record,
      productionEntries: input.productionEntries,
      productionOrders: input.productionOrders,
      riskProfile: input.riskProfile,
    };
  }, [refreshKey]);

  const registry = useMemo(
    () =>
      buildStrategyRegistry({
        entries: productionEntries,
        orders: productionOrders,
        riskProfile,
      }),
    [productionEntries, productionOrders, riskProfile],
  );

  const draftRules = useMemo(() => {
    void refreshKey;
    return loadDraftRules();
  }, [refreshKey]);

  const selected =
    selectedId != null
      ? getStrategyById(registry, selectedId) ?? null
      : registry.strategies[0] ?? null;

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const runAction = (fn: (s: StrategySkill) => void) => {
    if (!selected) return;
    fn(selected);
    refresh();
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-3 py-4 sm:px-5">
      <DataHealthPanel health={record.health} compact />
      <p className="text-xs text-zinc-500">
        Strategy registry sample size (backbone): {record.learning.strategySampleSize} ·
        resolved {record.learning.resolvedOutcomesCount}
      </p>
      <header className="desk-panel flex flex-wrap items-center justify-between gap-4 px-4 py-4">
        <div>
          <p className="desk-section-title text-indigo-400/90">MVP 13</p>
          <h1 className="text-lg font-semibold text-zinc-50">
            Strategy Skill Registry
          </h1>
          <p className="mt-1 max-w-xl text-xs text-zinc-500">
            Manage desk strategies — status gates committee agents and trade
            tickets. No live execution.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/"
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            ← Trading desk
          </Link>
          <Link
            href="/strategy-health"
            className="rounded-lg border border-indigo-900/50 px-3 py-1.5 text-xs text-indigo-200 hover:bg-indigo-950/40"
          >
            Strategy health
          </Link>
          <Link
            href="/strategy-lab/imports"
            className="rounded-lg border border-violet-900/50 px-3 py-1.5 text-xs text-violet-200 hover:bg-violet-950/40"
          >
            Quant imports
          </Link>
          <button
            type="button"
            onClick={refresh}
            className="rounded-lg bg-indigo-800/80 px-3 py-1.5 text-xs font-medium text-zinc-100"
          >
            Refresh
          </button>
        </div>
      </header>

      {healthRecs.length > 0 && (
        <section className="desk-panel border border-indigo-900/40 bg-indigo-950/15 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-indigo-300/80">
            MVP 74 testnet health recommendations (advisory only)
          </p>
          <ul className="mt-2 space-y-2 text-xs text-zinc-300">
            {healthRecs.slice(0, 5).map((rec) => (
              <li key={`${rec.strategyTag}-${rec.reportId}`}>
                <span className="font-mono text-zinc-100">{rec.strategyTag}</span> ·{" "}
                {rec.status} — {rec.recommendation}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-zinc-500">
            Does not auto-promote or demote registry status — operator approval required.
          </p>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <section className="desk-panel px-3 py-3">
          <h2 className="desk-section-title px-1">Strategy list</h2>
          <ul className="mt-2 max-h-[70vh] space-y-1 overflow-y-auto">
            {registry.strategies.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={`w-full rounded-lg px-3 py-2.5 text-left transition ${
                    selected?.id === s.id
                      ? "bg-indigo-950/60 ring-1 ring-indigo-600/40"
                      : "hover:bg-zinc-900/80"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-zinc-200">
                      {s.name}
                    </span>
                    <span className={statusClass(s.status)}>{s.status}</span>
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-zinc-500">
                    {s.productType} · score {s.performanceScore} · n=
                    {s.sampleSize}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {selected && (
          <section className="desk-panel space-y-4 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-50">
                  {selected.name}
                </h2>
                <p className="font-mono text-xs text-zinc-500">
                  {selected.id} · v{selected.version}
                </p>
              </div>
              <span className={statusClass(selected.status)}>
                {selected.status}
              </span>
            </div>

            <dl className="grid gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-zinc-500">Owner agent</dt>
                <dd className="text-zinc-200">{selected.ownerAgent}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Risk level</dt>
                <dd className="text-zinc-200">{selected.riskLevel}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Product</dt>
                <dd className="text-zinc-200">{selected.productType}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Last used</dt>
                <dd className="font-mono text-zinc-300">
                  {selected.lastUsed
                    ? new Date(selected.lastUsed).toLocaleString()
                    : "—"}
                </dd>
              </div>
            </dl>

            <div>
              <p className="text-[10px] uppercase text-zinc-500">
                Allowed regimes
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {selected.allowedRegimes
                  .map(
                    (r) =>
                      REGIME_ROUTER_RULES.find((x) => x.regime === r)?.label ??
                      r,
                  )
                  .join(" · ")}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase text-zinc-500">
                Required data
              </p>
              <ul className="mt-1 list-inside list-disc text-xs text-zinc-500">
                {selected.requiredData.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ["Score", selected.performanceScore],
                  ["Win %", selected.winRate],
                  ["Avg R", selected.avgR],
                  ["Max DD", `${selected.maxDrawdown}%`],
                ] as const
              ).map(([label, val]) => (
                <div
                  key={label}
                  className="rounded border border-zinc-800 bg-zinc-950/50 px-2 py-2"
                >
                  <p className="text-[10px] text-zinc-500">{label}</p>
                  <p className="font-mono text-sm text-zinc-100">{val}</p>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-zinc-600">{selected.promotionReason}</p>
            {selected.statusLocked && (
              <p className="text-xs text-amber-400/90">
                Manual status lock — click “Use auto status” to follow validation
                matrix again.
              </p>
            )}

            <div className="flex flex-wrap gap-2 border-t border-zinc-800 pt-3">
              <button
                type="button"
                onClick={() => runAction(promoteStrategy)}
                className="rounded bg-emerald-800/70 px-3 py-1.5 text-xs text-white"
              >
                Promote
              </button>
              <button
                type="button"
                onClick={() => runAction(demoteStrategy)}
                className="rounded border border-zinc-600 px-3 py-1.5 text-xs text-zinc-200"
              >
                Demote
              </button>
              <button
                type="button"
                onClick={() => runAction(disableStrategy)}
                className="rounded bg-rose-900/70 px-3 py-1.5 text-xs text-zinc-100"
              >
                Disable
              </button>
              {selected.statusLocked && (
                <button
                  type="button"
                  onClick={() => {
                    unlockAutoStatus(selected.id);
                    refresh();
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Use auto status
                </button>
              )}
            </div>

            <div className="border-t border-zinc-800 pt-3">
              <h3 className="text-xs font-semibold text-zinc-300">
                Linked draft rules
              </h3>
              {selected.linkedDraftRules.length === 0 ? (
                <p className="mt-1 text-xs text-zinc-600">None linked.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {selected.linkedDraftRules.map((rid) => {
                    const rule = draftRules.find((r) => r.id === rid);
                    return (
                      <li
                        key={rid}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="text-zinc-400">
                          {rule?.title ?? rid}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            unlinkDraftRuleFromStrategy(selected.id, rid);
                            refresh();
                          }}
                          className="text-rose-400/80 hover:text-rose-300"
                        >
                          Unlink
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <select
                  value={linkRuleId}
                  onChange={(e) => setLinkRuleId(e.target.value)}
                  className="min-w-[200px] rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
                >
                  <option value="">Select draft rule…</option>
                  {draftRules.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title.slice(0, 40)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!linkRuleId}
                  onClick={() => {
                    linkDraftRuleToStrategy(selected.id, linkRuleId);
                    setLinkRuleId("");
                    refresh();
                  }}
                  className="rounded border border-indigo-800 px-2 py-1 text-xs text-indigo-200 disabled:opacity-40"
                >
                  Link rule
                </button>
              </div>
            </div>

            <div className="border-t border-zinc-800 pt-3">
              <h3 className="text-xs font-semibold text-zinc-300">
                Version history
              </h3>
              <p className="mt-1 text-[10px] text-zinc-600">
                Placeholder — tracks operator status changes (not deployed code
                versions).
              </p>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-[10px] text-zinc-500">
                {selected.versionHistory.map((v, i) => (
                  <li key={`${v.changedAt}-${i}`}>
                    {v.changedAt.slice(0, 19)} · {v.status} · {v.note}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-[10px] text-zinc-600">
              <strong className="text-zinc-400">Committee impact:</strong>{" "}
              DISABLED/DEPRECATED → agent cannot propose TRADE. PAPER_TESTING /
              DRAFT / WATCHLIST → blocks semi-live trade tickets (committee may
              still TRADE for paper). Run Analyze after status changes.
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
