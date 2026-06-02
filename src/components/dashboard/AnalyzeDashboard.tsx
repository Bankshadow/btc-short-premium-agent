"use client";

import type { AnalyzeApiResponse } from "@/lib/types/market";
import { formValuesToOverrides } from "@/lib/decision/derivatives-overrides";
import { macroSelectionToStatus } from "@/lib/decision/macro-event";
import { useCallback, useState } from "react";
import AnalysisAlerts from "./AnalysisAlerts";
import DashboardView from "./DashboardView";
import MacroEventToggle, {
  useMacroEventSelection,
} from "./MacroEventToggle";
import ManualOverridesPanel, {
  useDerivativesOverrideForm,
} from "./ManualOverridesPanel";

interface AnalyzeDashboardProps {
  initialData: AnalyzeApiResponse;
  macroView?: "bearish" | "bullish" | "neutral";
}

export default function AnalyzeDashboard({
  initialData,
  macroView = "bearish",
}: AnalyzeDashboardProps) {
  const [data, setData] = useState<AnalyzeApiResponse>(initialData);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { values, setValues } = useDerivativesOverrideForm();
  const { value: macroEventSelection, setValue: setMacroEventSelection } =
    useMacroEventSelection();

  const handleAnalyze = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    const derivativesOverrides = formValuesToOverrides(values);
    const macroEvent = macroSelectionToStatus(macroEventSelection);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          macroView,
          derivativesOverrides,
          macroEvent,
        }),
      });

      const payload = (await response.json()) as
        | AnalyzeApiResponse
        | { error: string };

      if (!response.ok) {
        const message =
          "error" in payload ? payload.error : `HTTP ${response.status}`;
        throw new Error(message);
      }

      if ("error" in payload && !("step1_marketSnapshot" in payload)) {
        throw new Error(payload.error);
      }

      setData(payload as AnalyzeApiResponse);
    } catch (error) {
      setFetchError(
        error instanceof Error ? error.message : "Failed to run analysis",
      );
    } finally {
      setLoading(false);
    }
  }, [macroView, values, macroEventSelection]);

  return (
    <div className="relative flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Run a fresh analysis against live Bybit data.
        </p>
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading && (
            <span
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white dark:border-zinc-900/30 dark:border-t-zinc-900"
              aria-hidden
            />
          )}
          {loading ? "Analyzing…" : "Analyze Now"}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <MacroEventToggle
          value={macroEventSelection}
          onChange={setMacroEventSelection}
        />
        <ManualOverridesPanel values={values} onChange={setValues} />
      </div>

      <AnalysisAlerts
        fetchError={fetchError}
        sourceErrors={data.sourceErrors ?? []}
      />

      <div
        className={`flex flex-col gap-6 transition-opacity ${loading ? "pointer-events-none opacity-50" : ""}`}
        aria-busy={loading}
      >
        <DashboardView data={data} />
      </div>
    </div>
  );
}
