"use client";

import {
  EMPTY_OVERRIDE_FORM,
  formValuesToOverrides,
  loadOverridesFromStorage,
  saveOverridesToStorage,
  type DerivativesOverrideFormValues,
} from "@/lib/decision/derivatives-overrides";
import { useEffect, useState } from "react";

interface ManualOverridesPanelProps {
  values: DerivativesOverrideFormValues;
  onChange: (values: DerivativesOverrideFormValues) => void;
}

const FIELDS: Array<{
  key: keyof DerivativesOverrideFormValues;
  label: string;
  placeholder: string;
  hint: string;
}> = [
  {
    key: "liquidation24h",
    label: "Liquidation 24h (USD)",
    placeholder: "45000000",
    hint: "CoinGlass 24h liquidation total",
  },
  {
    key: "oi24hChange",
    label: "OI 24h Change (%)",
    placeholder: "-0.4",
    hint: "Open interest change over 24h",
  },
  {
    key: "oi1hChange",
    label: "OI 1h Change (%)",
    placeholder: "-1.97",
    hint: "Open interest change over 1h",
  },
  {
    key: "volume24hChange",
    label: "Volume 24h Change (%)",
    placeholder: "18",
    hint: "Volume change over 24h",
  },
];

export function useDerivativesOverrideForm() {
  const [values, setValues] =
    useState<DerivativesOverrideFormValues>(EMPTY_OVERRIDE_FORM);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setValues(loadOverridesFromStorage());
    setHydrated(true);
  }, []);

  const updateValues = (next: DerivativesOverrideFormValues) => {
    setValues(next);
    saveOverridesToStorage(next);
  };

  return {
    values,
    setValues: updateValues,
    overrides: formValuesToOverrides(values),
    hydrated,
  };
}

export default function ManualOverridesPanel({
  values,
  onChange,
}: ManualOverridesPanelProps) {
  const handleChange = (
    key: keyof DerivativesOverrideFormValues,
    raw: string,
  ) => {
    onChange({ ...values, [key]: raw });
  };

  const handleClear = () => {
    onChange(EMPTY_OVERRIDE_FORM);
  };

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Manual Input
          </p>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Derivatives Overrides
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Values saved in localStorage. Used on Analyze Now. Empty fields →
            Combination Read PARTIAL_DATA.
          </p>
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline dark:hover:text-zinc-300"
        >
          Clear all
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FIELDS.map((field) => (
          <label key={field.key} className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              {field.label}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={values[field.key]}
              onChange={(e) => handleChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <span className="block text-[11px] text-zinc-400">{field.hint}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
