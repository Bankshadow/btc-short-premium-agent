"use client";

import type { AnalyzeApiResponse, LiveMarketResponse, SpotQuote } from "@/lib/types/market";
import {
  BYBIT_API_FAILED_MESSAGE,
  isBybitCriticalFailure,
  isBybitFetchError,
} from "@/lib/decision/bybit-health";
import {
  EMPTY_OVERRIDE_FORM,
  resolveDerivativesOverrides,
} from "@/lib/decision/derivatives-overrides";
import {
  DEFAULT_MACRO_EVENT,
  macroSelectionToStatus,
} from "@/lib/decision/macro-event";
import { fetchLiveDecisionInput } from "@/lib/bybit/fetch-live-input";
import { getMockDashboardFallback } from "@/lib/mock/dashboard-data";
import { useCallback, useEffect, useMemo, useState } from "react";
import AgentScoreboardPanel from "./AgentScoreboardPanel";
import DecisionLogPanel from "./DecisionLogPanel";
import DecisionLogPreview from "./DecisionLogPreview";
import DraftRulesPanel from "./DraftRulesPanel";
import DashboardLoadingSkeleton from "./DashboardLoadingSkeleton";
import DashboardView from "./DashboardView";
import TestAutomationPanel from "./TestAutomationPanel";
import { buildClientMemoryPayload } from "@/lib/memory/build-desk-memory";
import { loadPinnedNotes } from "@/lib/memory/pinned-notes";
import { useDecisionLog } from "./useDecisionLog";
import TradingDeskLayout from "@/components/desk/TradingDeskLayout";
import DeskControlsSidebar from "@/components/desk/DeskControlsSidebar";
import { useAgentPipeline } from "@/hooks/useAgentPipeline";
import {
  DESK_REFRESH_OPTIONS,
  useAutoDeskRefresh,
} from "@/hooks/useAutoDeskRefresh";
import { usePaperTrading } from "@/hooks/usePaperTrading";
import PaperTradingPanel from "./PaperTradingPanel";
import PortfolioMilestonesPanel from "./portfolio/PortfolioMilestonesPanel";
import ReplayDeskPanel from "./replay/ReplayDeskPanel";
import { buildDeskPortfolioSnapshot } from "@/lib/portfolio/milestones";
import { mergeDecisionLogFromRemote } from "@/lib/journal/journal-merge";
import {
  pullJournalFromServer,
  syncJournalToServer,
} from "@/lib/journal/journal-cloud-sync";
import { loadDeskSettings, saveDeskSettings } from "@/lib/desk/desk-settings";
import type { ResolveOutcomeInput } from "@/lib/journal/decision-log-types";

const DEFAULT_MACRO_EVENT_STATUS = macroSelectionToStatus(DEFAULT_MACRO_EVENT);
const DEFAULT_DERIVATIVES_OVERRIDES = resolveDerivativesOverrides(
  EMPTY_OVERRIDE_FORM,
);

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

async function fetchEthQuoteForDesk(): Promise<SpotQuote | undefined> {
  try {
    const response = await fetch("/api/market", { cache: "no-store" });
    if (!response.ok) return undefined;
    const data = (await response.json()) as LiveMarketResponse;
    return data.eth?.price > 0 ? data.eth : undefined;
  } catch {
    return undefined;
  }
}

export default function AnalyzeDashboard({
  macroView = "bearish",
}: AnalyzeDashboardProps) {
  const [data, setData] = useState<AnalyzeApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [refreshIntervalMs, setRefreshIntervalMs] = useState<number>(
    DESK_REFRESH_OPTIONS[1].ms,
  );
  const {
    entries: logEntries,
    draftRules,
    scoreboard,
    saveFromAnalysis,
    resolveOutcome,
    refresh: refreshLog,
    hydrated: logHydrated,
  } = useDecisionLog();

  const paper = usePaperTrading();

  useEffect(() => {
    if (!paper.hydrated || !paper.settings.syncSupabase) return;
    void paper.pullFromServer();
  }, [paper.hydrated]);

  useEffect(() => {
    if (!logHydrated || !loadDeskSettings().syncJournalSupabase) return;
    void pullJournalFromServer().then((remote) => {
      if (remote.length > 0) {
        mergeDecisionLogFromRemote(remote);
        refreshLog();
      }
    });
  }, [logHydrated]);

  const controlsReady = logHydrated;

  const syncJournalIfEnabled = useCallback(async () => {
    if (!loadDeskSettings().syncJournalSupabase) return;
    await syncJournalToServer();
  }, []);

  const portfolio = useMemo(
    () => buildDeskPortfolioSnapshot(logEntries, paper.orders),
    [logEntries, paper.orders],
  );

  const persistAnalysis = useCallback(
    async (result: AnalyzeApiResponse) => {
      setData(result);
      const entry = saveFromAnalysis(result);
      await paper.afterAnalysis(result, entry.id);
      refreshLog();
      await syncJournalIfEnabled();
    },
    [saveFromAnalysis, paper.afterAnalysis, refreshLog, syncJournalIfEnabled],
  );

  const handleAnalyze = useCallback(async () => {
    if (!controlsReady) return;

    setLoading(true);
    setFetchError(null);
    setUsingFallback(false);

    const derivativesOverrides = DEFAULT_DERIVATIVES_OVERRIDES;
    const macroEvent = DEFAULT_MACRO_EVENT_STATUS;
    const deskMemory = buildClientMemoryPayload(
      logEntries,
      draftRules,
      loadPinnedNotes(),
    );
    const ethQuote = await fetchEthQuoteForDesk();
    const analyzeRequest = {
      macroView,
      macroEvent,
      deskMemory,
      ethQuote,
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
      let result: AnalyzeApiResponse | null = null;

      try {
        const serverResult = await postAnalyze(analyzeRequest);
        if (isLiveAnalysis(serverResult)) {
          result = serverResult;
        }
      } catch {
        // Server-side Bybit may fail on Vercel
      }

      if (!result) {
        const engineInput = await fetchLiveDecisionInput(analyzeRequest);
        const clientResult = await postAnalyze({
          ...engineInput,
          deskMemory,
          ethQuote,
          ...derivativesOverrides,
          derivativesOverrides,
        });
        if (isLiveAnalysis(clientResult)) {
          result = clientResult;
        } else if (
          isBybitCriticalFailure(
            clientResult.marketSnapshot,
            clientResult.dataSourceIssues,
          )
        ) {
          throw new Error(BYBIT_API_FAILED_MESSAGE);
        } else {
          result = clientResult;
        }
      }

      if (result && isLiveAnalysis(result)) {
        await persistAnalysis(result);
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
      await persistAnalysis(getMockDashboardFallback());
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  }, [
    macroView,
    logEntries,
    draftRules,
    persistAnalysis,
    controlsReady,
  ]);

  const { secondsUntilRefresh, trigger } = useAutoDeskRefresh(handleAnalyze, {
    enabled: autoRefreshEnabled,
    intervalMs: refreshIntervalMs,
    ready: controlsReady,
  });

  const handleResolveOutcome = useCallback(
    (id: string, input: ResolveOutcomeInput) => {
      resolveOutcome(id, input);
      refreshLog();
      paper.refresh();
      void paper.syncToServer();
      void syncJournalIfEnabled();
      trigger();
    },
    [resolveOutcome, refreshLog, paper, trigger, syncJournalIfEnabled],
  );

  const { statusById, activeIndex, pipelineRunning } = useAgentPipeline(loading);

  const sourceIssues = (
    data?.dataSourceIssues ?? data?.sourceErrors ?? []
  ).filter((issue) => {
    if (
      fetchError === BYBIT_API_FAILED_MESSAGE &&
      issue.message === BYBIT_API_FAILED_MESSAGE
    ) {
      return false;
    }
    if (
      usingFallback &&
      /fallback data|demo mode|mock data only/i.test(
        `${issue.source} ${issue.message}`,
      )
    ) {
      return false;
    }
    return true;
  });

  const lastAnalyzedAt =
    data?.step5_verdict.analyzedAt ?? data?.tradingDesk?.analyzedAt ?? null;

  return (
    <TradingDeskLayout
      data={data}
      desk={data?.tradingDesk ?? null}
      loading={loading || !controlsReady}
      usingFallback={usingFallback}
      lastAnalyzedAt={lastAnalyzedAt}
      secondsUntilRefresh={secondsUntilRefresh}
      autoRefreshEnabled={autoRefreshEnabled}
      refreshIntervalMs={refreshIntervalMs}
      onRefreshIntervalChange={setRefreshIntervalMs}
      onToggleAutoRefresh={() => setAutoRefreshEnabled((v) => !v)}
      onRefreshNow={() => trigger()}
      statusById={statusById}
      activeIndex={activeIndex}
      pipelineRunning={pipelineRunning}
      sidebar={
        <DeskControlsSidebar
          fetchError={fetchError}
          sourceErrors={sourceIssues}
        />
      }
    >
      {(!controlsReady || (loading && !data?.tradingDesk)) && (
        <DashboardLoadingSkeleton />
      )}

      {data?.tradingDesk && (
        <div
          className={`flex flex-col gap-4 transition-opacity ${loading ? "pointer-events-none opacity-60" : ""}`}
          aria-busy={loading}
        >
          <PortfolioMilestonesPanel portfolio={portfolio} />
          <PaperTradingPanel
            orders={paper.orders}
            openOrders={paper.openOrders}
            summary={paper.summary}
            settings={paper.settings}
            syncStatus={paper.syncStatus}
            syncedOpenOrders={paper.syncedOpenOrders}
            currentBtcPrice={data.step1_marketSnapshot.spotPrice}
            onSettingsChange={paper.updateSettings}
            onCloseOrder={async (id, input) => {
              await paper.closeOrder(id, input);
              refreshLog();
            }}
            onSync={() => void paper.syncToServer()}
            onPull={() => void paper.pullFromServer()}
          />
          <DashboardView data={data} onMemoryPinsChange={() => trigger()} />
          <ReplayDeskPanel entries={logEntries} />
          <DecisionLogPreview entries={logEntries} />
        </div>
      )}

      <details className="desk-panel group">
        <summary className="cursor-pointer list-none px-4 py-3 text-xs font-medium text-zinc-400 [&::-webkit-details-marker]:hidden">
          Operations · journal sync · scoreboard · rules
          <span className="ml-2 opacity-50 group-open:hidden">▸</span>
          <span className="ml-2 hidden opacity-50 group-open:inline">▾</span>
        </summary>
        <div className="flex flex-col gap-4 border-t border-zinc-800 px-4 pb-4 pt-3">
          <label className="flex items-center gap-2 px-1 text-xs text-zinc-400">
            <input
              type="checkbox"
              defaultChecked={loadDeskSettings().syncJournalSupabase}
              onChange={(e) =>
                saveDeskSettings({ syncJournalSupabase: e.target.checked })
              }
            />
            Sync decision log to Supabase after each session
          </label>
          <AgentScoreboardPanel scoreboard={scoreboard} />
          <DecisionLogPanel
            entries={logEntries}
            onResolve={handleResolveOutcome}
          />
          <DraftRulesPanel
            rules={draftRules}
            onRefresh={() => {
              refreshLog();
              trigger();
            }}
          />
          <TestAutomationPanel />
        </div>
      </details>
    </TradingDeskLayout>
  );
}
