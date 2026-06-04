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
    <section className="desk-panel p-4">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="desk-section-title">Derivatives desk</p>
          <h2 className="text-sm font-semibold text-zinc-100">
            Manual overrides
          </h2>
          <p className="mt-1 text-[10px] text-zinc-500">
            Auto re-run ~1s after edit · empty → partial data
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
            <span className="text-[10px] font-medium text-zinc-400">
              {field.label}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={values[field.key]}
              onChange={(e) => handleChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 font-mono text-xs text-zinc-100 outline-none focus:ring-2 focus:ring-amber-600/40"
            />
            <span className="block text-[11px] text-zinc-400">{field.hint}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
