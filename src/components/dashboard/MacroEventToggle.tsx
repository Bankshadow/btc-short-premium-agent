"use client";

import {
  DEFAULT_MACRO_EVENT,
  loadMacroEventFromStorage,
  MACRO_EVENT_OPTIONS,
  saveMacroEventToStorage,
  type MacroEventSelection,
} from "@/lib/decision/macro-event";
import { useEffect, useState } from "react";

interface MacroEventToggleProps {
  value: MacroEventSelection;
  onChange: (value: MacroEventSelection) => void;
}

export function useMacroEventSelection() {
  const [value, setValue] = useState<MacroEventSelection>(DEFAULT_MACRO_EVENT);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setValue(loadMacroEventFromStorage());
    setHydrated(true);
  }, []);

  const updateValue = (next: MacroEventSelection) => {
    setValue(next);
    saveMacroEventToStorage(next);
  };

  return { value, setValue: updateValue, hydrated };
}

export default function MacroEventToggle({
  value,
  onChange,
}: MacroEventToggleProps) {
  const isSkip = value.type !== "none";

  return (
    <section className="desk-panel p-4">
      <header className="mb-3">
        <p className="desk-section-title">Macro desk</p>
        <h2 className="text-sm font-semibold text-zinc-100">
          Event before settlement
        </h2>
        <p className="mt-1 text-[10px] text-zinc-500">
          Desk re-runs automatically when changed
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {MACRO_EVENT_OPTIONS.map((option) => {
          const selected = value.type === option.type;
          return (
            <button
              key={option.type}
              type="button"
              onClick={() => onChange({ type: option.type })}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                selected
                  ? option.type === "none"
                    ? "border-zinc-500 bg-zinc-700 text-zinc-100"
                    : "border-red-700 bg-red-950 text-red-200"
                  : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-600"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {isSkip && (
        <p className="mt-3 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          Macro event selected — No-Trade Rule will trigger SKIP before 15:00 TH
          settlement.
        </p>
      )}
    </section>
  );
}
