"use client";

import type { AnalyzeApiResponse } from "@/lib/types/market";
import {
  BYBIT_API_FAILED_MESSAGE,
  isBybitCriticalFailure,
  isBybitFetchError,
} from "@/lib/decision/bybit-health";
import { resolveDerivativesOverrides } from "@/lib/decision/derivatives-overrides";
import { macroSelectionToStatus } from "@/lib/decision/macro-event";
import { fetchLiveDecisionInput } from "@/lib/bybit/fetch-live-input";
import { getMockDashboardFallback } from "@/lib/mock/dashboard-data";
import { useCallback, useState } from "react";
import AgentScoreboardPanel from "./AgentScoreboardPanel";
import DecisionLogPanel from "./DecisionLogPanel";
import DecisionLogPreview from "./DecisionLogPreview";
import DraftRulesPanel from "./DraftRulesPanel";
import AnalysisAlerts from "./AnalysisAlerts";
import DashboardEmptyState from "./DashboardEmptyState";
import DashboardLoadingSkeleton from "./DashboardLoadingSkeleton";
import DashboardView from "./DashboardView";
import LiveSpotPrices from "./LiveSpotPrices";
import MacroEventToggle, {
  useMacroEventSelection,
} from "./MacroEventToggle";
import ManualOverridesPanel, {
  useDerivativesOverrideForm,
} from "./ManualOverridesPanel";
import TestAutomationPanel from "./TestAutomationPanel";
import { useDecisionLog } from "./useDecisionLog";

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

function isLiveAnalysis(payload: AnalyzeApiResponse): boolean {
  return payload.marketSnapshot.spotPrice > 0;
}

export default function AnalyzeDashboard({
  macroView = "bearish",
}: AnalyzeDashboardProps) {
  const [data, setData] = useState<AnalyzeApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const { values, setValues } = useDerivativesOverrideForm();
  const { value: macroEventSelection, setValue: setMacroEventSelection } =
    useMacroEventSelection();
  const {
    entries: logEntries,
    draftRules,
    scoreboard,
    saveFromAnalysis,
    resolveOutcome,
    refresh: refreshLog,
  } = useDecisionLog();

  const persistAnalysis = useCallback(
    (result: AnalyzeApiResponse) => {
      setData(result);
      saveFromAnalysis(result);
    },
    [saveFromAnalysis],
  );

  const handleAnalyze = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    setUsingFallback(false);

    const derivativesOverrides = resolveDerivativesOverrides(values);
    const macroEvent = macroSelectionToStatus(macroEventSelection);
    const analyzeRequest = {
      macroView,
      macroEvent,
      ...derivativesOverrides,
      derivativesOverrides,
    };

    const postAnalyze = async (body: unknown) => {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as
        | AnalyzeApiResponse
        | { error: string };

      if (!response.ok) {
        const message =
          "error" in payload ? payload.error : `HTTP ${response.status}`;
        throw new Error(
          isBybitFetchError(message) ? BYBIT_API_FAILED_MESSAGE : message,
        );
      }

      if ("error" in payload && !isAnalyzeApiResponse(payload)) {
        throw new Error(payload.error);
      }

      if (!isAnalyzeApiResponse(payload)) {
        throw new Error("Invalid analysis response from server.");
      }

      return payload;
    };

    try {
      // 1) Server-side fetch via /api/analyze (works on localhost)
      let result: AnalyzeApiResponse | null = null;

      try {
        const serverResult = await postAnalyze(analyzeRequest);
        if (isLiveAnalysis(serverResult)) {
          result = serverResult;
        }
      } catch {
        // Server-side Bybit fetch may fail on cloud hosts (HTTP 403)
      }

      // 2) Browser-side Bybit fetch, then run engine on server (works on Vercel)
      if (!result) {
        const engineInput = await fetchLiveDecisionInput(analyzeRequest);
        const clientResult = await postAnalyze({
          ...engineInput,
          ...derivativesOverrides,
          derivativesOverrides,
        });
        if (isLiveAnalysis(clientResult)) {
          result = clientResult;
        } else if (isBybitCriticalFailure(clientResult.marketSnapshot, clientResult.dataSourceIssues)) {
          throw new Error(BYBIT_API_FAILED_MESSAGE);
        } else {
          result = clientResult;
        }
      }

      if (result && isLiveAnalysis(result)) {
        persistAnalysis(result);
        setFetchError(null);
        setUsingFallback(false);
        return;
      }

      throw new Error(BYBIT_API_FAILED_MESSAGE);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to run analysis";
      const bybitFailed = isBybitFetchError(message);

      setFetchError(bybitFailed ? BYBIT_API_FAILED_MESSAGE : message);
      const fallback = getMockDashboardFallback();
      persistAnalysis(fallback);
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  }, [macroView, values, macroEventSelection, persistAnalysis]);

  const sourceIssues = (
    data?.dataSourceIssues ?? data?.sourceErrors ?? []
  ).filter((issue) => {
    if (fetchError === BYBIT_API_FAILED_MESSAGE && issue.message === BYBIT_API_FAILED_MESSAGE) {
      return false;
    }
    if (usingFallback && /fallback data|demo mode|mock data only/i.test(`${issue.source} ${issue.message}`)) {
      return false;
    }
    return true;
  });

  return (
    <div className="relative flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          TradingAgents-Style Crypto Desk
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          MVP 3: decision log, paper outcomes, reflection, and agent scoreboard — Bybit
          public data only. No auto trading.
        </p>
      </header>

      <LiveSpotPrices />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Run committee analysis against live Bybit public data.
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

      {!loading && !data && !fetchError && <DashboardEmptyState />}

      {data && (
        <div
          className={`flex flex-col gap-6 transition-opacity ${loading ? "pointer-events-none opacity-50" : ""}`}
          aria-busy={loading}
        >
          <DashboardView data={data} />
          <DecisionLogPreview entries={logEntries} />
        </div>
      )}

      <AgentScoreboardPanel scoreboard={scoreboard} />
      <DecisionLogPanel
        entries={logEntries}
        onResolve={(id, input) => resolveOutcome(id, input)}
      />
      <DraftRulesPanel rules={draftRules} onRefresh={refreshLog} />

      <TestAutomationPanel />
    </div>
  );
}
