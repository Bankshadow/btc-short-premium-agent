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

  useEffect(() => {
    setValue(loadMacroEventFromStorage());
  }, []);

  const updateValue = (next: MacroEventSelection) => {
    setValue(next);
    saveMacroEventToStorage(next);
  };

  return { value, setValue: updateValue };
}

export default function MacroEventToggle({
  value,
  onChange,
}: MacroEventToggleProps) {
  const isSkip = value.type !== "none";

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Macro Calendar
        </p>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Event Before Settlement
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Saved in localStorage. Any major event triggers No-Trade SKIP.
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
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                selected
                  ? option.type === "none"
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-red-600 bg-red-600 text-white dark:border-red-500 dark:bg-red-600"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {isSkip && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          Macro event selected — No-Trade Rule will trigger SKIP before 15:00 TH
          settlement.
        </p>
      )}
    </section>
  );
}
