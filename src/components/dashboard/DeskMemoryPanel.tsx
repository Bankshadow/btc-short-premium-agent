"use client";

import type { DeskMemorySnapshot } from "@/lib/memory/types";
import {
  addPinnedNote,
  loadPinnedNotes,
  removePinnedNote,
} from "@/lib/memory/pinned-notes";
import { useCallback, useEffect, useState } from "react";

interface DeskMemoryPanelProps {
  memory: DeskMemorySnapshot;
  onPinsChange?: () => void;
}

export default function DeskMemoryPanel({
  memory,
  onPinsChange,
}: DeskMemoryPanelProps) {
  const [pinned, setPinned] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPinned(loadPinnedNotes());
    setHydrated(true);
  }, []);

  const refreshPins = useCallback(() => {
    setPinned(loadPinnedNotes());
    onPinsChange?.();
  }, [onPinsChange]);

  const handleAdd = () => {
    addPinnedNote(draft);
    setDraft("");
    refreshPins();
  };

  const handleRemove = (index: number) => {
    removePinnedNote(index);
    refreshPins();
  };

  const { buckets, agent } = memory;

  return (
    <section className="desk-panel border-violet-900/40">
      <div className="border-b border-zinc-800 px-4 py-3">
        <p className="desk-section-title text-violet-400/90">Research desk</p>
        <h2 className="text-sm font-semibold text-zinc-100">Institutional memory</h2>
        <p className="mt-0.5 text-[10px] text-zinc-500">
          Pins & journal feed agents on next desk run (advisory only)
        </p>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <div>
          <p className="desk-section-title">Memory officer</p>
          <p className="mt-1 text-xs text-zinc-300">
            {agent.marketView} · {agent.recommendation} ({agent.confidence})
          </p>
          <ul className="mt-2 space-y-1 text-[11px] text-zinc-500">
            {agent.reasons.slice(0, 4).map((r) => (
              <li key={r} className="border-l border-violet-800 pl-2">
                {r}
              </li>
            ))}
          </ul>
          <p className="mt-2 font-mono text-[10px] text-zinc-600">
            R{memory.resolvedCount} · P{memory.pendingCount} · A
            {memory.approvedRuleCount}
          </p>
        </div>

        <div>
          <p className="desk-section-title">
            Bullets ({memory.bullets.length})
          </p>
          {memory.bullets.length === 0 ? (
            <p className="mt-1 text-[10px] text-zinc-600">
              Resolve outcomes or approve rules to build context.
            </p>
          ) : (
            <ul className="mt-1 max-h-32 space-y-1 overflow-y-auto">
              {memory.bullets.map((b) => (
                <li
                  key={b}
                  className="rounded bg-violet-950/30 px-2 py-1 text-[10px] text-violet-100/90"
                >
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="border-t border-zinc-800 px-4 py-3">
        <p className="desk-section-title">Pinned notes</p>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Desk lesson for next session…"
            className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="shrink-0 rounded-lg bg-violet-800 px-3 py-2 text-xs font-medium text-violet-100 hover:bg-violet-700"
          >
            Pin
          </button>
        </div>
        {hydrated && pinned.length > 0 && (
          <ul className="mt-2 space-y-1">
            {pinned.map((note, i) => (
              <li
                key={`${note}-${i}`}
                className="flex items-center justify-between gap-2 rounded bg-zinc-900/80 px-2 py-1 text-[10px] text-zinc-400"
              >
                <span>{note}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(i)}
                  className="text-zinc-600 hover:text-red-400"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
