"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { buildReport } from "@/lib/trading-os/build-reports";
import { loadWorkspaceConfig } from "@/lib/trading-os/workspace-store";
import { getDeskProfile } from "@/lib/trading-os/desk-profiles";
import type { ReportKind } from "@/lib/trading-os/trading-os-types";

const REPORTS: { kind: ReportKind; label: string }[] = [
  { kind: "daily_desk", label: "Daily desk report" },
  { kind: "weekly_performance", label: "Weekly performance report" },
  { kind: "agent_scoreboard", label: "Agent scoreboard" },
  { kind: "risk_incidents", label: "Risk incident report" },
];

export default function ReportsDashboard() {
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("");

  const ws = useMemo(() => loadWorkspaceConfig(), []);
  const profile = getDeskProfile(ws.activeProfileId);

  const generate = (kind: ReportKind) => {
    const report = buildReport(kind, {
      entries: loadDecisionLog(),
      orders: loadPaperOrders(),
      profile,
      mode: ws.environmentMode,
    });
    setPreview(report.content);
    setTitle(report.title);
  };

  const download = () => {
    if (!preview) return;
    const blob = new Blob([preview], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    if (!preview) return;
    await navigator.clipboard.writeText(preview);
  };

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-6 px-3 py-4 sm:px-5">
      <header className="desk-panel px-4 py-4">
        <p className="desk-section-title text-cyan-400/90">MVP 15</p>
        <h1 className="text-lg font-semibold text-zinc-50">Report export</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Markdown exports from local decision log, paper book, and incidents.
        </p>
        <Link href="/workspace" className="mt-2 inline-block text-xs text-cyan-400 hover:underline">
          ← Workspace
        </Link>
      </header>

      <section className="desk-panel flex flex-wrap gap-2 px-4 py-4">
        {REPORTS.map((r) => (
          <button
            key={r.kind}
            type="button"
            onClick={() => generate(r.kind)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 hover:border-cyan-800"
          >
            {r.label}
          </button>
        ))}
      </section>

      {preview && (
        <section className="desk-panel px-4 py-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copy()}
              className="rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200"
            >
              Copy
            </button>
            <button
              type="button"
              onClick={download}
              className="rounded bg-cyan-900/60 px-3 py-1.5 text-xs text-cyan-100"
            >
              Download .md
            </button>
          </div>
          <pre className="mt-4 max-h-[480px] overflow-auto whitespace-pre-wrap font-mono text-[11px] text-zinc-400">
            {preview}
          </pre>
        </section>
      )}
    </div>
  );
}
