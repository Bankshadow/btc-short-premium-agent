"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import type {
  ImportedStrategyCard,
  QuantImporterCatalog,
  QuantImportStatus,
} from "@/lib/quant-strategy-importer/types";
import { QUANT_IMPORT_SAFETY_NOTICE } from "@/lib/quant-strategy-importer/types";

function statusClass(status: QuantImportStatus): string {
  const map: Record<QuantImportStatus, string> = {
    RESEARCH_ONLY: "text-amber-300 bg-amber-950/30 border-amber-900/50",
    READY_FOR_BACKTEST: "text-violet-300 bg-violet-950/30 border-violet-900/50",
    READY_FOR_PAPER: "text-cyan-300 bg-cyan-950/30 border-cyan-900/50",
    REJECTED: "text-rose-300 bg-rose-950/30 border-rose-900/50",
  };
  return `rounded border px-2 py-0.5 text-[10px] font-semibold uppercase ${map[status]}`;
}

function useClass(use: string): string {
  const map: Record<string, string> = {
    ENTRY: "text-emerald-300",
    EXIT: "text-cyan-300",
    FILTER: "text-indigo-300",
    RISK_GATE: "text-rose-300",
    RESEARCH_ONLY: "text-zinc-400",
  };
  return map[use] ?? "text-zinc-400";
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function QuantStrategyImporterDashboard() {
  const [catalog, setCatalog] = useState<QuantImporterCatalog | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<QuantImportStatus | "ALL">("ALL");

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/quant-strategy-importer");
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? res.statusText);
      setCatalog(data.catalog as QuantImporterCatalog);
      if (!selectedId && data.catalog?.strategies?.length) {
        setSelectedId(data.catalog.strategies[0].sourceId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load imports");
    } finally {
      setBusy(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const strategies = useMemo(() => {
    if (!catalog) return [];
    if (statusFilter === "ALL") return catalog.strategies;
    return catalog.strategies.filter((s) => s.importStatus === statusFilter);
  }, [catalog, statusFilter]);

  const selected = useMemo(
    () => strategies.find((s) => s.sourceId === selectedId) ?? strategies[0] ?? null,
    [strategies, selectedId],
  );

  const promote = async (
    card: ImportedStrategyCard,
    targetStatus: "READY_FOR_BACKTEST" | "READY_FOR_PAPER" | "REJECTED",
  ) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/quant-strategy-importer/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: card.sourceId,
          targetStatus,
          humanApproval: true,
          operatorNote: `Promoted from Strategy Lab UI → ${targetStatus}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? data.message ?? res.statusText);
      setMessage(data.message as string);
      await refresh();
      if (data.backtestUrl && targetStatus === "READY_FOR_BACKTEST") {
        window.open(data.backtestUrl, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Promotion failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <OpsShell
      badge="MVP 66 · Research only"
      title="Quant Strategy Importer"
      subtitle="External quant references from je-suis-tm/quant-trading — staged for AI review, never auto-traded."
      accent="violet"
      iconLetters="QI"
      activePath="/strategy-lab/imports"
      nav={[
        { href: "/strategy-garage", label: "Garage", primary: true },
        { href: "/strategies", label: "Registry" },
        { href: "/strategy-lab/imports", label: "Imports" },
        { href: "/strategy-lab/backtest", label: "Backtest" },
        { href: "/strategy-lab/tournament", label: "Tournament" },
        { href: "/strategy-lab/shadow", label: "Shadow" },
        { href: "/experiments", label: "Experiments" },
        { href: "/validation", label: "Validation" },
        { href: "/", label: "← Desk" },
      ]}
      actions={
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900/60"
        >
          {busy ? "..." : "Refresh"}
        </button>
      }
    >
      <div className="mb-4 rounded-lg border border-rose-900/40 bg-rose-950/20 px-4 py-3 text-xs text-rose-200/90">
        {QUANT_IMPORT_SAFETY_NOTICE}
      </div>

      {error && (
        <p className="mb-3 text-xs text-rose-300">{error}</p>
      )}
      {message && (
        <p className="mb-3 text-xs text-emerald-300">{message}</p>
      )}

      {catalog && (
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <OpsKpi label="Imported" value={String(catalog.strategies.length)} />
          <OpsKpi
            label="Research"
            value={String(catalog.statusCounts.RESEARCH_ONLY)}
          />
          <OpsKpi
            label="Backtest queue"
            value={String(catalog.statusCounts.READY_FOR_BACKTEST)}
          />
          <OpsKpi
            label="Rejected"
            value={String(catalog.statusCounts.REJECTED)}
          />
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {(["ALL", "RESEARCH_ONLY", "READY_FOR_BACKTEST", "READY_FOR_PAPER", "REJECTED"] as const).map(
          (f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              className={`rounded border px-2 py-1 text-[10px] ${
                statusFilter === f
                  ? "border-violet-600/60 bg-violet-950/40 text-violet-200"
                  : "border-zinc-700 text-zinc-500 hover:border-zinc-600"
              }`}
            >
              {f === "ALL" ? "All" : f.replace(/_/g, " ")}
            </button>
          ),
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel title="Imported strategies">
          <p className="mb-3 text-[11px] text-zinc-500">
            Source:{" "}
            <a
              href={catalog?.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-300 hover:underline"
            >
              {catalog?.sourceRepo ?? "je-suis-tm/quant-trading"}
            </a>
          </p>
          <ul className="max-h-[520px] space-y-2 overflow-y-auto">
            {strategies.map((card) => (
              <li key={card.sourceId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(card.sourceId)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                    selected?.sourceId === card.sourceId
                      ? "border-violet-700/60 bg-violet-950/25"
                      : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-zinc-100">
                        {card.strategyName}
                      </p>
                      <p className="text-[11px] text-zinc-500">{card.category}</p>
                    </div>
                    <span className={statusClass(card.importStatus)}>
                      {card.importStatus.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className={`mt-1 text-[10px] ${useClass(card.suggestedUse)}`}>
                    Use: {card.suggestedUse.replace(/_/g, " ")}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        {selected && (
          <div className="space-y-4">
            <Panel title={selected.strategyName}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={statusClass(selected.importStatus)}>
                  {selected.importStatus.replace(/_/g, " ")}
                </span>
                <span className={`text-[10px] font-semibold ${useClass(selected.suggestedUse)}`}>
                  Suggested: {selected.suggestedUse.replace(/_/g, " ")}
                </span>
                <a
                  href={selected.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-violet-300 hover:underline"
                >
                  View original →
                </a>
              </div>
              <p className="mt-3 text-xs text-zinc-300">{selected.description}</p>
              <p className="mt-3 text-xs text-zinc-400">
                <span className="font-semibold text-zinc-300">Thesis (BTC/SOL):</span>{" "}
                {selected.thesis}
              </p>
            </Panel>

            <Panel title="AI review summary">
              <p className="text-xs leading-relaxed text-zinc-300">
                {selected.aiReviewSummary}
              </p>
            </Panel>

            <Panel title="Crypto context">
              <div className="space-y-3 text-xs text-zinc-400">
                <div>
                  <p className="font-semibold text-zinc-300">Regime fit</p>
                  <ul className="mt-1 list-inside list-disc">
                    {selected.marketRegimeFit.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-zinc-300">Adaptation notes</p>
                  <ul className="mt-1 list-inside list-disc">
                    {selected.cryptoAdaptationNotes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-zinc-300">Required data</p>
                  <p className="mt-1">{selected.requiredData.join(" · ")}</p>
                </div>
                <p className="text-rose-300/90">{selected.riskWarning}</p>
              </div>
            </Panel>

            <Panel title="Original assumptions">
              <ul className="list-inside list-disc text-xs text-zinc-400">
                {selected.originalAssumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </Panel>

            <Panel title="Human actions">
              <p className="mb-3 text-[11px] text-zinc-500">
                Imported strategies cannot execute orders or change live settings.
                Promotion requires explicit approval.
              </p>
              <div className="flex flex-wrap gap-2">
                {selected.importStatus === "RESEARCH_ONLY" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void promote(selected, "READY_FOR_BACKTEST")}
                    className="rounded-lg bg-violet-700/90 px-3 py-2 text-xs font-semibold text-zinc-50 hover:bg-violet-600 disabled:opacity-50"
                  >
                    Promote to backtest
                  </button>
                )}
                {selected.importStatus === "READY_FOR_BACKTEST" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void promote(selected, "READY_FOR_PAPER")}
                    className="rounded-lg border border-cyan-800/60 bg-cyan-950/30 px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-950/50 disabled:opacity-50"
                  >
                    Mark ready for paper
                  </button>
                )}
                {selected.importStatus !== "REJECTED" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void promote(selected, "REJECTED")}
                    className="rounded-lg border border-rose-900/50 px-3 py-2 text-xs text-rose-300 hover:bg-rose-950/30 disabled:opacity-50"
                  >
                    Reject
                  </button>
                )}
                <Link
                  href={`/strategy-lab/backtest?importId=${encodeURIComponent(selected.sourceId)}&source=quant-import`}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900/50"
                >
                  Open backtest lab →
                </Link>
              </div>
            </Panel>
          </div>
        )}
      </div>
    </OpsShell>
  );
}
