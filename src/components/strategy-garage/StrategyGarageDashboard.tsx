"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import { GARAGE_NAV_LINKS } from "@/lib/strategy-garage/config";
import type {
  StrategyGarageCard,
  StrategyGarageCatalog,
  StrategyGarageStage,
} from "@/lib/strategy-garage/types";
import { STRATEGY_GARAGE_SAFETY_NOTICE } from "@/lib/strategy-garage/types";

const STAGE_STYLE: Record<StrategyGarageStage, string> = {
  IMPORTED: "text-zinc-400 bg-zinc-900/50 border-zinc-700",
  AI_REVIEWED: "text-sky-300 bg-sky-950/30 border-sky-900/50",
  BACKTEST_READY: "text-violet-300 bg-violet-950/30 border-violet-900/50",
  SHADOW_TESTING: "text-teal-300 bg-teal-950/30 border-teal-900/50",
  TESTNET_READY: "text-cyan-300 bg-cyan-950/30 border-cyan-900/50",
  APPROVED_FOR_USE: "text-emerald-300 bg-emerald-950/30 border-emerald-900/50",
  REJECTED: "text-rose-300 bg-rose-950/30 border-rose-900/50",
};

const RISK_STYLE: Record<string, string> = {
  LOW: "text-emerald-400",
  MEDIUM: "text-amber-400",
  HIGH: "text-orange-400",
  EXTREME: "text-rose-400",
};

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">{title}</h2>
      {children}
    </section>
  );
}

export default function StrategyGarageDashboard() {
  const [catalog, setCatalog] = useState<StrategyGarageCatalog | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<StrategyGarageStage | "ALL">("ALL");
  const [importName, setImportName] = useState("");
  const [importDesc, setImportDesc] = useState("");
  const [importUrl, setImportUrl] = useState("");

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/strategy-garage/catalog", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Load failed");
      setCatalog(data.catalog as StrategyGarageCatalog);
      if (!selectedId && data.catalog?.strategies?.length) {
        setSelectedId(data.catalog.strategies[0].sourceId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load garage");
    } finally {
      setBusy(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const strategies = useMemo(() => {
    if (!catalog) return [];
    if (stageFilter === "ALL") return catalog.strategies;
    return catalog.strategies.filter((s) => s.stage === stageFilter);
  }, [catalog, stageFilter]);

  const selected = useMemo(
    () => strategies.find((s) => s.sourceId === selectedId) ?? strategies[0] ?? null,
    [strategies, selectedId],
  );

  const promote = async (card: StrategyGarageCard, targetStage: StrategyGarageStage) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/strategy-garage/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: card.sourceId,
          targetStage,
          humanApproval: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message ?? data.error ?? "Promote failed");
      setMessage(data.message);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Promote failed");
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (
    path: "/api/strategy-garage/review" | "/api/strategy-garage/backtest" | "/api/strategy-garage/shadow",
    sourceId: string,
  ) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data.message ?? data.error ?? "Action failed");
      setMessage(data.message ?? "Done");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const importStrategy = async () => {
    if (!importName.trim() || !importDesc.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/strategy-garage/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importSource: importUrl.includes("github") ? "github" : importUrl ? "link" : "manual",
          sourceUrl: importUrl || undefined,
          strategyName: importName,
          description: importDesc,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Import failed");
      setMessage(`Imported ${data.strategy.strategyName}`);
      setImportName("");
      setImportDesc("");
      setImportUrl("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <OpsShell
      title="Strategy Garage"
      subtitle="Import · review · backtest · shadow · promote — research pipeline only."
      badge="MVP 81"
      accent="teal"
      iconLetters="SG"
      activePath="/strategy-garage"
      nav={[...GARAGE_NAV_LINKS]}
      actions={
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={busy}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900/60 disabled:opacity-50"
        >
          {busy ? "..." : "Refresh"}
        </button>
      }
    >
      {catalog && (
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <OpsKpi label="Strategies" value={String(catalog.strategies.length)} />
          <OpsKpi
            label="Approved for AI"
            value={String(catalog.stageCounts.APPROVED_FOR_USE)}
          />
          <OpsKpi label="In shadow" value={String(catalog.stageCounts.SHADOW_TESTING)} />
          <OpsKpi label="Rejected" value={String(catalog.stageCounts.REJECTED)} />
        </div>
      )}

      <p className="mb-4 text-[11px] text-zinc-500">{STRATEGY_GARAGE_SAFETY_NOTICE}</p>

      {error && (
        <p className="mb-3 rounded border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}
      {message && (
        <p className="mb-3 rounded border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200">
          {message}
        </p>
      )}

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Import strategy">
          <div className="space-y-2 text-xs">
            <input
              value={importName}
              onChange={(e) => setImportName(e.target.value)}
              placeholder="Strategy name"
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-200"
            />
            <input
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="GitHub or link (optional)"
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-200"
            />
            <textarea
              value={importDesc}
              onChange={(e) => setImportDesc(e.target.value)}
              placeholder="Manual description"
              rows={3}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-200"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void importStrategy()}
              className="rounded bg-violet-800/70 px-3 py-1.5 text-[11px] font-semibold text-zinc-100 hover:bg-violet-700/70 disabled:opacity-50"
            >
              Import (research only)
            </button>
          </div>
        </Panel>

        <div className="lg:col-span-2">
          <Panel title="Pipeline">
            <div className="mb-3 flex flex-wrap gap-2">
              {(["ALL", ...Object.keys(catalog?.stageCounts ?? {})] as const).map((stage) => (
                <button
                  key={stage}
                  type="button"
                  onClick={() => setStageFilter(stage as StrategyGarageStage | "ALL")}
                  className={`rounded border px-2 py-0.5 text-[10px] ${
                    stageFilter === stage
                      ? "border-violet-700 bg-violet-950/40 text-violet-200"
                      : "border-zinc-700 text-zinc-500"
                  }`}
                >
                  {stage}
                </button>
              ))}
            </div>
            <ul className="max-h-64 space-y-1 overflow-auto text-xs">
              {strategies.map((s) => (
                <li key={s.sourceId}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(s.sourceId)}
                    className={`flex w-full items-center justify-between gap-2 rounded border px-2 py-1.5 text-left ${
                      selected?.sourceId === s.sourceId
                        ? "border-violet-700/60 bg-violet-950/20"
                        : "border-zinc-800/70 hover:bg-zinc-900/40"
                    }`}
                  >
                    <span className="text-zinc-200">{s.strategyName}</span>
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[9px] uppercase ${STAGE_STYLE[s.stage]}`}
                    >
                      {s.stage.replace(/_/g, " ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      {selected && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title={selected.strategyName}>
            <div className="space-y-2 text-xs text-zinc-400">
              <p>
                <span className="text-zinc-500">Risk:</span>{" "}
                <span className={RISK_STYLE[selected.riskClass]}>{selected.riskClass}</span>
                {" · "}
                <span className="text-zinc-500">Use:</span> {selected.suggestedUse}
              </p>
              <p>{selected.description}</p>
              <p className="text-zinc-500">{selected.thesis}</p>
              {selected.aiReviewSummary && (
                <p className="rounded border border-zinc-800 bg-zinc-950/50 p-2 text-[11px] text-zinc-300">
                  {selected.aiReviewSummary}
                </p>
              )}
              <p className="text-[10px] text-zinc-600">{selected.nextAction}</p>
            </div>
          </Panel>

          <Panel title="Actions (human approval)">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void runAction("/api/strategy-garage/review", selected.sourceId)}
                className="rounded border border-sky-800/60 px-2 py-1 text-[10px] text-sky-200 hover:bg-sky-950/40 disabled:opacity-50"
              >
                AI review
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runAction("/api/strategy-garage/backtest", selected.sourceId)}
                className="rounded border border-violet-800/60 px-2 py-1 text-[10px] text-violet-200 hover:bg-violet-950/40 disabled:opacity-50"
              >
                Backtest
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runAction("/api/strategy-garage/shadow", selected.sourceId)}
                className="rounded border border-teal-800/60 px-2 py-1 text-[10px] text-teal-200 hover:bg-teal-950/40 disabled:opacity-50"
              >
                Shadow run
              </button>
              <Link
                href={selected.backtestUrl ?? "#"}
                className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 hover:text-zinc-200"
              >
                Open backtest lab
              </Link>
              <Link
                href={selected.shadowUrl}
                className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 hover:text-zinc-200"
              >
                Open shadow lab
              </Link>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-800/70 pt-3">
              <button
                type="button"
                disabled={busy || !selected.canPromote}
                onClick={() => void promote(selected, "BACKTEST_READY")}
                className="rounded bg-violet-900/50 px-2 py-1 text-[10px] text-violet-100 disabled:opacity-40"
              >
                → Backtest ready
              </button>
              <button
                type="button"
                disabled={busy || !selected.canPromote}
                onClick={() => void promote(selected, "TESTNET_READY")}
                className="rounded bg-cyan-900/50 px-2 py-1 text-[10px] text-cyan-100 disabled:opacity-40"
              >
                → Testnet ready
              </button>
              <button
                type="button"
                disabled={busy || !selected.canApproveForAiLoop}
                onClick={() => void promote(selected, "APPROVED_FOR_USE")}
                className="rounded bg-emerald-900/50 px-2 py-1 text-[10px] text-emerald-100 disabled:opacity-40"
              >
                Approve for AI loop
              </button>
              <button
                type="button"
                disabled={busy || !selected.canReject}
                onClick={() => void promote(selected, "REJECTED")}
                className="rounded bg-rose-900/50 px-2 py-1 text-[10px] text-rose-100 disabled:opacity-40"
              >
                Reject
              </button>
            </div>

            {selected.lastBacktest && (
              <p className="mt-3 text-[10px] text-zinc-500">
                Last backtest: {selected.lastBacktest.aiVerdict} · {selected.lastBacktest.tradeCount}{" "}
                trades · {selected.lastBacktest.netPnlPct}% net
              </p>
            )}
            {selected.lastShadow && (
              <p className="mt-1 text-[10px] text-zinc-500">
                Shadow: {selected.lastShadow.closedTrades} trades · win{" "}
                {selected.lastShadow.winRate}% · eligible{" "}
                {selected.lastShadow.eligibleForPromotion ? "yes" : "no"}
              </p>
            )}
          </Panel>
        </div>
      )}
    </OpsShell>
  );
}
