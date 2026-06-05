"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { enqueueOptionsTestnetPreview } from "@/lib/options-execution/testnet-preview-queue";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { OrderTicket } from "@/lib/trade-control/trade-control-types";
import type { OptionsOrderPreview } from "@/lib/options-execution/types";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadGovernanceState } from "@/lib/governance/governance-state";
import { loadIncidents } from "@/lib/governance/incidents-store";
import {
  appendOptionsPreviewJournal,
  journalEntryFromPreview,
  loadOptionsPreviewJournal,
} from "@/lib/options-execution/preview-journal-store";

interface OptionsPreviewPanelProps {
  data: AnalyzeApiResponse;
  ticket: OrderTicket;
}

function riskColor(status: string): string {
  if (status === "PASS") return "text-emerald-400";
  if (status === "WARNING") return "text-amber-400";
  return "text-rose-400";
}

export default function OptionsPreviewPanel({
  data,
  ticket,
}: OptionsPreviewPanelProps) {
  const [preview, setPreview] = useState<OptionsOrderPreview | null>(null);
  const [paperLinked, setPaperLinked] = useState<{
    linked: boolean;
    paperOrderId: string | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testnetResult, setTestnetResult] = useState<string | null>(null);

  const runPreview = useCallback(async () => {
    setBusy(true);
    setError(null);
    setTestnetResult(null);
    try {
      const res = await fetch("/api/options/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket,
          data,
          decisionLogId: ticket.decisionLogId,
          entries: loadDecisionLog(),
          orders: loadPaperOrders(),
          paperOrders: loadPaperOrders(),
          governance: loadGovernanceState(),
          incidents: loadIncidents(),
          journal: loadOptionsPreviewJournal(),
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? res.statusText);

      const p = payload.preview as OptionsOrderPreview;
      setPreview(p);
      setPaperLinked(payload.paperLink ?? null);

      appendOptionsPreviewJournal(
        journalEntryFromPreview(p, {
          paperOrderLinked: payload.paperLink?.linked ?? false,
          paperOrderId: payload.paperLink?.paperOrderId ?? null,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }, [data, ticket]);

  const runTestnetSim = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/options/testnet-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preview,
          journal: loadOptionsPreviewJournal(),
        }),
      });
      const payload = await res.json();
      if (payload.journalEntry) {
        appendOptionsPreviewJournal(payload.journalEntry);
      }
      if (!res.ok) throw new Error(payload.error ?? "Testnet sim blocked");
      setTestnetResult(
        `Simulated: ${payload.simulatedOrderId} (no real order sent)`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Testnet sim failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="desk-panel border-violet-900/40 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-violet-200">
          BTC Options Preview (MVP 27)
        </h2>
        <span className="rounded bg-violet-950/60 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-300/90 ring-1 ring-violet-800/50">
          Preview only — real BTC options live disabled
        </span>
      </div>
      <p className="mt-1 text-[11px] text-zinc-500">
        Maps playbook ticket to Bybit option instrument · estimates premium, margin,
        and risk · compare with paper panel above.
      </p>

      <button
        type="button"
        disabled={busy}
        onClick={() => void runPreview()}
        className="mt-3 rounded-lg bg-violet-800/80 px-3 py-2 text-xs font-semibold text-zinc-100 disabled:opacity-50"
      >
        {busy ? "Building preview…" : "Build options preview"}
      </button>

      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      {testnetResult && (
        <p className="mt-2 text-xs text-cyan-300">{testnetResult}</p>
      )}

      {preview && (
        <div className="mt-4 space-y-3 text-xs">
          <div className="flex flex-wrap gap-2">
            <span
              className={
                preview.valid ? "font-bold text-emerald-400" : "font-bold text-rose-400"
              }
            >
              {preview.valid ? "VALID PREVIEW" : "REJECTED"}
            </span>
            {preview.ticket && (
              <span className="font-mono text-zinc-300">
                {preview.ticket.optionsInstrument.symbol}
              </span>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <p className="text-[10px] text-zinc-600">Premium est.</p>
              <p className="text-zinc-200">${preview.estimatedPremiumUsd}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-600">Max loss est.</p>
              <p className="text-zinc-200">${preview.estimatedMaxLossUsd}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-600">Margin est.</p>
              <p className="text-zinc-200">
                ${preview.margin.estimatedMarginUsd}
                {preview.margin.marginUsagePct != null &&
                  ` (${preview.margin.marginUsagePct}%)`}
              </p>
            </div>
          </div>

          {preview.estimatedBreakevenIndex != null && (
            <p className="text-zinc-500">
              Breakeven index ~ {preview.estimatedBreakevenIndex.toLocaleString()}
            </p>
          )}

          {paperLinked && (
            <p
              className={
                paperLinked.linked ? "text-emerald-400/90" : "text-zinc-500"
              }
            >
              Paper order:{" "}
              {paperLinked.linked
                ? `linked (${paperLinked.paperOrderId})`
                : "none for this candidate"}
            </p>
          )}

          <div>
            <p className="text-[10px] font-semibold uppercase text-zinc-500">
              Risk checks
            </p>
            <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto">
              {preview.riskChecks.map((c) => (
                <li key={c.id} className={riskColor(c.status)}>
                  {c.label}: {c.message}
                </li>
              ))}
            </ul>
          </div>

          {preview.valid && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void runTestnetSim()}
                className="rounded border border-cyan-800/50 px-2 py-1 text-[10px] text-cyan-300"
              >
                Simulate testnet order (no API)
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  enqueueOptionsTestnetPreview(preview);
                  setTestnetResult("Queued on /options-testnet — enable testnet env to execute.");
                }}
                className="rounded border border-cyan-700/60 bg-cyan-950/30 px-2 py-1 text-[10px] text-cyan-200"
              >
                Queue for testnet execute
              </button>
              <Link
                href="/options-testnet"
                className="rounded border border-cyan-900/40 px-2 py-1 text-[10px] text-cyan-400 hover:underline"
              >
                Options testnet desk →
              </Link>
            </div>
          )}

          <p className="text-[10px] text-zinc-600">{preview.disclaimer}</p>
        </div>
      )}
    </section>
  );
}
