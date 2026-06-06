"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import type { LiveEvidenceReport } from "@/lib/live-evidence";

function statusClass(status: string): string {
  if (status === "PASS") return "bg-emerald-900/50 text-emerald-200 ring-emerald-700/40";
  if (status === "WARNING") return "bg-amber-900/50 text-amber-200 ring-amber-700/40";
  return "bg-rose-900/50 text-rose-200 ring-rose-700/40";
}

export default function LiveEvidenceDashboard() {
  const [report, setReport] = useState<LiveEvidenceReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportPreview, setExportPreview] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/live-evidence", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Failed to load live evidence report");
      }
      setReport(data.report as LiveEvidenceReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load live evidence");
    } finally {
      setBusy(false);
    }
  }, []);

  const exportReport = useCallback(
    async (format: "all" | "json" | "markdown") => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/live-evidence/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? "Export failed");
        }

        if (format === "json") {
          const payload = JSON.stringify(data.report, null, 2);
          setExportPreview(payload.slice(0, 3000));
          const blob = new Blob([payload], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `live-evidence-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
          return;
        }

        const markdown = (data.markdown ?? "") as string;
        setExportPreview(markdown.slice(0, 3000));
        const blob = new Blob([markdown], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `live-evidence-${new Date().toISOString().slice(0, 10)}.md`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Export failed");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <OpsShell
      badge="MVP 53 · Evidence Pack"
      title="Live Readiness Evidence Pack"
      subtitle="Evidence-based readiness pack for micro live pilot. This page is recommendation-only and cannot enable live."
      accent="emerald"
      iconLetters="LE"
      activePath="/live-evidence"
      nav={[
        { href: "/", label: "← Desk" },
        { href: "/live-readiness", label: "Live readiness", primary: true },
        { href: "/strategy-health", label: "Strategy health" },
        { href: "/risk-replay", label: "Risk replay" },
      ]}
      actions={
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => void refresh()}
            className="rounded-lg border border-emerald-800/60 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-950/40 disabled:opacity-50"
          >
            {busy ? "Refreshing..." : "Refresh evidence"}
          </button>
          <button
            type="button"
            disabled={busy || !report}
            onClick={() => void exportReport("markdown")}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-900/60 disabled:opacity-50"
          >
            Export Markdown
          </button>
          <button
            type="button"
            disabled={busy || !report}
            onClick={() => void exportReport("json")}
            className="rounded-lg bg-emerald-700/90 px-3 py-2 text-xs font-semibold text-zinc-100 disabled:opacity-50"
          >
            Export JSON
          </button>
        </>
      }
    >
      <p className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-4 py-2 text-xs text-emerald-200/80">
        Evidence pack cannot enable live. It only recommends readiness. Live enable still requires
        separate approval and env changes.
      </p>

      {error && <p className="rounded border border-rose-900/50 px-3 py-2 text-xs text-rose-300">{error}</p>}

      {report && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <OpsKpi
              label="Readiness score"
              value={`${report.readinessScore}/100`}
              hint={report.readyForMicroLivePilot ? "Candidate ready" : "Not ready"}
            />
            <OpsKpi
              label="Hard blockers"
              value={String(report.hardBlockersTriggered.length)}
              hint={report.hardBlockersTriggered.length ? "Must clear all" : "None"}
            />
            <OpsKpi
              label="Category fails"
              value={String(report.categories.filter((c) => c.status === "FAIL").length)}
              hint="Evidence categories"
            />
            <OpsKpi
              label="Next actions"
              value={String(report.nextRequiredActions.length)}
              hint="Actionable operator steps"
            />
          </div>

          <section className="desk-panel border-rose-900/40 px-5 py-4">
            <h2 className="text-sm font-semibold text-rose-300">Hard blockers</h2>
            {report.hardBlockersTriggered.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">None</p>
            ) : (
              <ul className="mt-2 space-y-1 text-xs text-rose-200/90">
                {report.hardBlockersTriggered.map((b) => (
                  <li key={b.key}>
                    {b.key}: {b.message}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="desk-panel px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-100">Next required actions</h2>
            {report.nextRequiredActions.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">No actions required.</p>
            ) : (
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-zinc-400">
                {report.nextRequiredActions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ol>
            )}
          </section>

          <section className="desk-panel px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-100">Evidence categories</h2>
            <ul className="mt-3 grid gap-3 lg:grid-cols-2">
              {report.categories.map((cat) => (
                <li key={cat.id} className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold text-zinc-100">{cat.label}</h3>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${statusClass(cat.status)}`}
                    >
                      {cat.status}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1 text-[11px] text-zinc-400">
                    {cat.evidence.map((e) => (
                      <li key={e}>Evidence: {e}</li>
                    ))}
                  </ul>
                  <ul className="mt-2 space-y-1 text-[11px] text-amber-300/90">
                    {(cat.missingItems.length ? cat.missingItems : ["none"]).map((m) => (
                      <li key={m}>Missing: {m}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-indigo-300/80">Recommendation: {cat.recommendation}</p>
                </li>
              ))}
            </ul>
          </section>

          {exportPreview && (
            <section className="desk-panel px-5 py-4">
              <h2 className="text-sm font-semibold text-zinc-100">Export preview</h2>
              <pre className="ops-memo mt-2 max-h-48 overflow-auto text-[10px]">{exportPreview}</pre>
            </section>
          )}

          <p className="text-[10px] text-zinc-600">
            Generated: {new Date(report.generatedAt).toLocaleString()} · <Link href="/live-pilot" className="text-emerald-400 hover:underline">Live pilot page</Link> still enforces separate approval.
          </p>
        </>
      )}
    </OpsShell>
  );
}
