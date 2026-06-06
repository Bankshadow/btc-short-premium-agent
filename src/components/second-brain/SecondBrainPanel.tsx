"use client";

import { useCallback, useEffect, useState } from "react";
import type { SecondBrainGraphView } from "@/lib/second-brain/types";
import type { SecondBrainMemorySummary } from "@/lib/second-brain/types";
import { SECOND_BRAIN_SAFETY_NOTICE } from "@/lib/second-brain/types";

type StatusPayload = {
  ok: boolean;
  summary?: SecondBrainMemorySummary;
  graph?: SecondBrainGraphView;
  memoryCount?: number;
  lastConsolidatedAt?: string | null;
  error?: string;
};

export default function SecondBrainPanel() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/second-brain/status", { cache: "no-store" });
      const json = (await res.json()) as StatusPayload;
      setData(json);
    } catch {
      setData({ ok: false, error: "Failed to load second brain" });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const summary = data?.summary;
  const graph = data?.graph;

  return (
    <div className="space-y-3 text-xs text-zinc-400">
      <p className="text-[10px] text-zinc-600">{SECOND_BRAIN_SAFETY_NOTICE}</p>
      {busy && <p className="text-zinc-600">Loading…</p>}
      {summary && (
        <>
          <p className="font-medium text-zinc-300">{summary.headline}</p>
          <ul className="space-y-0.5">
            {summary.consciousHighlights.map((h) => (
              <li key={h} className="text-zinc-500">
                · {h}
              </li>
            ))}
          </ul>
          {summary.topLessons.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase text-zinc-600">
                Relevant lessons
              </p>
              <ul className="space-y-1">
                {summary.topLessons.map((l) => (
                  <li
                    key={l}
                    className="rounded border border-violet-900/30 bg-violet-950/20 px-2 py-1 text-[11px] text-violet-100/90"
                  >
                    {l}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {graph && graph.nodes.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase text-zinc-600">
            Memory graph · {graph.nodes.length} nodes · {graph.edges.length} edges
          </p>
          <div className="max-h-48 space-y-1 overflow-y-auto font-mono text-[10px]">
            {graph.nodes.slice(0, 24).map((n) => (
              <div
                key={n.id}
                className={`rounded px-2 py-1 ${
                  n.layer === "conscious"
                    ? "border border-sky-900/40 bg-sky-950/20 text-sky-200/80"
                    : "border border-zinc-800 bg-zinc-950/40 text-zinc-400"
                }`}
              >
                <span className="text-zinc-600">{n.layer}</span> · {n.type}: {n.label}
              </div>
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void refresh()}
        className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-900 disabled:opacity-50"
      >
        Refresh graph
      </button>
    </div>
  );
}
