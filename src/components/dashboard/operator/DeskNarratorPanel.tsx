"use client";

import type { AnalyzeApiResponse } from "@/lib/types/market";

interface DeskNarratorPanelProps {
  data: AnalyzeApiResponse | null;
}

export default function DeskNarratorPanel({ data }: DeskNarratorPanelProps) {
  const narrator = data?.deskNarrator;
  if (!narrator?.text) return null;

  return (
    <section className="desk-panel border-indigo-900/30 px-4 py-3">
      <p className="desk-section-title text-indigo-400/80">
        Desk narrator · MVP 9
        <span className="ml-2 font-normal text-zinc-600">
          {narrator.source === "llm" ? "LLM" : "template"} · {narrator.locale}
        </span>
      </p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-300">{narrator.text}</p>
      <p className="mt-2 text-[10px] text-zinc-600">
        Advisory only — does not change committee verdict or execution.
      </p>
    </section>
  );
}
