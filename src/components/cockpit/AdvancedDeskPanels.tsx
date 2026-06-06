"use client";

import type { ReactNode } from "react";

type Panel = { id: string; title: string; summary?: string; children: ReactNode };

export default function AdvancedDeskPanels({ panels }: { panels: Panel[] }) {
  return (
    <div className="flex flex-col gap-3">
      {panels.map((p) => (
        <details key={p.id} className="desk-panel group rounded-xl border border-zinc-800/80">
          <summary className="cursor-pointer list-none px-4 py-3 text-xs font-medium text-zinc-400 [&::-webkit-details-marker]:hidden">
            {p.title}
            {p.summary && (
              <span className="ml-2 font-normal text-zinc-600">— {p.summary}</span>
            )}
            <span className="ml-2 opacity-50 group-open:hidden">▸</span>
            <span className="ml-2 hidden opacity-50 group-open:inline">▾</span>
          </summary>
          <div className="border-t border-zinc-800 px-4 pb-4 pt-3">{p.children}</div>
        </details>
      ))}
    </div>
  );
}
