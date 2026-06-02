"use client";

import type { AnalyzeApiResponse } from "@/lib/types/market";
import {
  BYBIT_API_FAILED_MESSAGE,
  isBybitCriticalFailure,
  isBybitFetchError,
} from "@/lib/decision/bybit-health";
import { formValuesToOverrides } from "@/lib/decision/derivatives-overrides";
import { macroSelectionToStatus } from "@/lib/decision/macro-event";
import { useCallback, useState } from "react";
import AnalysisAlerts from "./AnalysisAlerts";
import DashboardEmptyState from "./DashboardEmptyState";
import DashboardLoadingSkeleton from "./DashboardLoadingSkeleton";
import DashboardView from "./DashboardView";
import MacroEventToggle, {
  useMacroEventSelection,
} from "./MacroEventToggle";
import ManualOverridesPanel, {
  useDerivativesOverrideForm,
} from "./ManualOverridesPanel";

interface AnalyzeDashboardProps {
  macroView?: "bearish" | "bullish" | "neutral";
}

function isAnalyzeApiResponse(
  payload: unknown,
): payload is AnalyzeApiResponse {
  return (
    typeof payload === "object" &&
    payload !== null &&
    ("step1_marketSnapshot" in payload || "marketSnapshot" in payload)
  );
}

export default function AnalyzeDashboard({
  macroView = "bearish",
}: AnalyzeDashboardProps) {
  const [data, setData] = useState<AnalyzeApiResponse | null>(null);
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
        throw new Error(
          response.status === 503 || isBybitFetchError(message)
            ? BYBIT_API_FAILED_MESSAGE
            : message,
        );
      }

      if ("error" in payload && !isAnalyzeApiResponse(payload)) {
        throw new Error(payload.error);
      }

      if (!isAnalyzeApiResponse(payload)) {
        throw new Error("Invalid analysis response from server.");
      }

      setData(payload);

      if (
        isBybitCriticalFailure(payload.marketSnapshot, payload.dataSourceIssues)
      ) {
        setFetchError(BYBIT_API_FAILED_MESSAGE);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to run analysis";
      setFetchError(
        isBybitFetchError(message) ? BYBIT_API_FAILED_MESSAGE : message,
      );
    } finally {
      setLoading(false);
    }
  }, [macroView, values, macroEventSelection]);

  const sourceIssues = (data?.dataSourceIssues ?? data?.sourceErrors ?? []).filter(
    (issue) =>
      !(
        fetchError === BYBIT_API_FAILED_MESSAGE &&
        issue.message === BYBIT_API_FAILED_MESSAGE
      ),
  );

  return (
    <div className="relative flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Run a fresh analysis against live Bybit public data.
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

      <AnalysisAlerts fetchError={fetchError} sourceErrors={sourceIssues} />

      {loading && !data && <DashboardLoadingSkeleton />}

      {data && (
        <div
          className={`flex flex-col gap-6 transition-opacity ${loading ? "pointer-events-none opacity-50" : ""}`}
          aria-busy={loading}
        >
          <DashboardView data={data} />
        </div>
      )}

      {!loading && !data && fetchError && (
        <DashboardEmptyState />
      )}
    </div>
  );
}
