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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DecisionLogPreview from "./DecisionLogPreview";
import DashboardLoadingSkeleton from "./DashboardLoadingSkeleton";
import DashboardView from "./DashboardView";
import TestAutomationPanel from "./TestAutomationPanel";
import { buildClientMemoryPayload } from "@/lib/memory/build-desk-memory";
import { loadPinnedNotes } from "@/lib/memory/pinned-notes";
import { loadIncidents } from "@/lib/governance/incidents-store";
import { loadCouncilSessions } from "@/lib/council/council-session-store";
import { loadAdaptationProposals } from "@/lib/strategy-adaptation/proposal-store";
import { useDecisionLog } from "./useDecisionLog";
import TradingDeskLayout from "@/components/desk/TradingDeskLayout";
import DeskControlsSidebar from "@/components/desk/DeskControlsSidebar";
import { useAgentPipeline } from "@/hooks/useAgentPipeline";
import {
  DESK_REFRESH_OPTIONS,
  useAutoDeskRefresh,
} from "@/hooks/useAutoDeskRefresh";
import { usePaperTrading } from "@/hooks/usePaperTrading";
import { useDeskAutomation } from "@/hooks/useDeskAutomation";
import ReplayDeskPanel from "./replay/ReplayDeskPanel";
import { buildDeskPortfolioSnapshot } from "@/lib/portfolio/milestones";
import { mergeDecisionLogFromRemote } from "@/lib/journal/journal-merge";
import { pushWarehouseAfterAnalyze } from "@/lib/db/client-warehouse-sync";
import {
  pullJournalFromServer,
  syncJournalToServer,
} from "@/lib/journal/journal-cloud-sync";
import { loadDeskSettings, saveDeskSettings } from "@/lib/desk/desk-settings";
import { usePermission, useWorkspace } from "@/contexts/WorkspaceContext";
import { buildPolicyInput, evaluatePolicy } from "@/lib/policy-engine";
import { useWorkspaceFetchHeaders } from "@/components/platform/PlatformWorkspaceHeaders";
import { cacheLatestAnalyze } from "@/lib/live-trading-readiness/latest-analyze-cache";
import type {
  DecisionLogEntry,
  ResolveOutcomeInput,
} from "@/lib/journal/decision-log-types";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { isHumanApprovalRequired } from "@/lib/trade-control/trade-control-settings";
import { buildRegistryPayloadForAnalyze } from "@/lib/strategy-registry/build-strategy-registry";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { buildStrategyRegistry } from "@/lib/strategy-registry/build-strategy-registry";
import { loadGovernanceState } from "@/lib/governance/governance-state";
import { buildGovernancePayloadForAnalyze } from "@/lib/governance/build-governance-payload";
import {
  appendAdaptiveWeightingAudit,
  buildAdaptiveWeightingPayload,
} from "@/lib/adaptive-agent-weighting";
import { loadEvaluationResults } from "@/lib/self-learning";
import TradeControlPanel from "@/components/trade-control/TradeControlPanel";
import {
  applyWorkspaceSideEffects,
  loadWorkspaceConfig,
} from "@/lib/trading-os/workspace-store";
import {
  allowMockFallbackInCurrentMode,
  getTradingOsModeEffects,
} from "@/lib/trading-os/trading-os-runtime";
import { getDeskProfile } from "@/lib/trading-os/desk-profiles";
import { ENVIRONMENT_MODE_LABELS } from "@/lib/trading-os/environment-modes";
import OperatorDeskPanel from "./operator/OperatorDeskPanel";
import DeskNarratorPanel from "./operator/DeskNarratorPanel";
import BacktestDeskPanel from "./operator/BacktestDeskPanel";
import CommandCockpit from "@/components/cockpit/CommandCockpit";
import CockpitAdvancedDrawers from "@/components/cockpit/CockpitAdvancedDrawers";
import StrategySignalPanel from "@/components/strategy-lab/StrategySignalPanel";
import AgentOsMatrixPanel from "@/components/agent-os/AgentOsMatrixPanel";
import PermissionPrompt from "@/components/agent-os/PermissionPrompt";
import { useAgentOs } from "@/hooks/useAgentOs";
import { loadAgentOsSettings } from "@/lib/agent-os/settings-store";
import AIStatusCard from "@/components/ai-status/AIStatusCard";
import AIStatusTechnicalLog from "@/components/ai-status/AIStatusTechnicalLog";
import SecondBrainPanel from "@/components/second-brain/SecondBrainPanel";
import ParallelReviewPanel from "@/components/parallel-task-runner/ParallelReviewPanel";
import ContinuousImprovementPanel from "@/components/continuous-improvement/ContinuousImprovementPanel";
import TelegramControlPanel from "@/components/telegram-control/TelegramControlPanel";
import { useAiStatusCard } from "@/hooks/useAiStatusCard";
import { useAutopilot } from "@/hooks/useAutopilot";
import { useBackgroundWorker } from "@/hooks/useBackgroundWorker";
import { loadClientWorkerSettings } from "@/lib/background-worker/client-settings";
import { loadOperatorActionQueue } from "@/lib/operator-action-queue/queue-store";
import { resolveEffectiveMode } from "@/lib/autopilot/config";
import { loadAutopilotSettings } from "@/lib/autopilot/settings-store";
import {
  emitFromAnalysis,
  emitOutcomeResolved,
} from "@/lib/smart-briefing/event-helpers";
import {
  applyAutopilotPaperSettings,
  resolveAutopilotPaperEffects,
} from "@/lib/autopilot/apply-paper-effects";
import type { CommandCenterStatus } from "@/lib/command-center/types";
import type { AutopilotRunResult } from "@/lib/autopilot/types";
import type { SaveAnalysisResult } from "@/lib/journal/decision-log";
import DemoSeedPanel from "@/components/demo/DemoSeedPanel";
import { writeDeskCycle } from "@/lib/data-backbone/write-desk-cycle";
import { loadDeskBackbone } from "@/lib/data-backbone/read-desk-state";
import DataHealthPanel from "@/components/data-backbone/DataHealthPanel";
import { buildBinancePreviewInputFromAiSignal } from "@/lib/exchange/binance/build-ai-preview";
import { enqueueBinanceTestnetPreview } from "@/lib/exchange/binance/binance-preview-queue";

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
  const [lastLogId, setLastLogId] = useState<string | null>(null);
  const [tradeControlEntry, setTradeControlEntry] =
    useState<DecisionLogEntry | null>(null);
  const [workspace, setWorkspace] = useState(loadWorkspaceConfig);
  const workspaceHeaders = useWorkspaceFetchHeaders();
  const { workspace: wsContext, role, settings: wsSettings } = useWorkspace();
  const canRunAnalysis = usePermission("canRunAnalysis");

  useEffect(() => {
    applyWorkspaceSideEffects(workspace);
  }, [workspace]);
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
  const automation = useDeskAutomation(logHydrated);
  const [actionQueue, setActionQueue] = useState(
    () => loadOperatorActionQueue().filter((a) => a.status === "OPEN"),
  );
  const [binancePreviewBusy, setBinancePreviewBusy] = useState(false);
  const [binancePreviewMessage, setBinancePreviewMessage] = useState<string | null>(
    null,
  );
  const [persistStatus, setPersistStatus] = useState<{
    ok: boolean;
    message: string;
    result?: SaveAnalysisResult;
  } | null>(null);
  const handleAnalyzeRef = useRef<(() => Promise<void>) | null>(null);

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

  const autopilotRunRef = useRef<
    (opts?: { triggerAnalyze?: boolean }) => Promise<AutopilotRunResult | null>
  >(async () => null);
  const initialAutopilotRef = useRef(false);

  const persistAnalysis = useCallback(
    async (result: AnalyzeApiResponse, opts?: { isDemo?: boolean }) => {
      setData(result);
      cacheLatestAnalyze(result);
      const weighted = result.tradingDesk?.weightedCommittee;
      if (weighted && result.tradingDesk) {
        appendAdaptiveWeightingAudit(weighted, result.tradingDesk.marketRegime);
      }
      try {
        const saved = saveFromAnalysis(result, {
          analyzeStatus: opts?.isDemo ? "DEMO" : "SUCCESS",
          isDemoData: opts?.isDemo ?? false,
        });
        setLastLogId(saved.entry.id);
        setPersistStatus({
          ok: true,
          message:
            saved.status === "updated"
              ? `Decision log updated for run ${saved.entry.runId ?? saved.entry.id}.`
              : `Decision log saved · ${saved.entry.finalVerdict} · linked to desk cycle.`,
          result: saved,
        });
        const fresh =
          loadDecisionLog().find((e) => e.id === saved.entry.id) ?? saved.entry;
        setTradeControlEntry(fresh);

        const apSettings = loadAutopilotSettings();
        applyAutopilotPaperSettings(apSettings);
        const paperEffects = resolveAutopilotPaperEffects(
          apSettings,
          loadPaperOrders(),
        );
        await paper.afterAnalysis(result, saved.entry.id, {
          skipAutoOpen: paperEffects.skipAutoOpen,
        });
        void emitFromAnalysis(result, { isDemo: opts?.isDemo });
        refreshLog();
        setTradeControlEntry(
          loadDecisionLog().find((e) => e.id === saved.entry.id) ?? fresh,
        );
        await syncJournalIfEnabled();
        const latest =
          loadDecisionLog().find((e) => e.id === saved.entry.id) ?? saved.entry;
        await pushWarehouseAfterAnalyze(result, latest);
        const runResult = await autopilotRunRef.current();
        await writeDeskCycle({ autopilotResult: runResult ?? undefined });
        if (runResult) {
          setActionQueue(loadOperatorActionQueue().filter((a) => a.status === "OPEN"));
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to persist decision log";
        setPersistStatus({ ok: false, message });
      }
    },
    [saveFromAnalysis, paper.afterAnalysis, refreshLog, syncJournalIfEnabled],
  );

  const handleAnalyze = useCallback(async () => {
    if (!controlsReady) return;
    if (!canRunAnalysis) {
      setFetchError(
        "Analysis requires TRADER, RISK_MANAGER, ADMIN, or OWNER workspace role.",
      );
      return;
    }

    const govState = loadGovernanceState();
    if (govState.pauseAnalysis) {
      setFetchError(
        "Analysis paused by governance — clear “Pause all analysis” on /governance.",
      );
      return;
    }

    setLoading(true);
    setFetchError(null);
    setUsingFallback(false);

    const derivativesOverrides = DEFAULT_DERIVATIVES_OVERRIDES;
    const macroEvent = DEFAULT_MACRO_EVENT_STATUS;
    const ethQuote = await fetchEthQuoteForDesk();
    const deskSettings = loadDeskSettings();
    const logSnapshot = loadDecisionLog();
    const ordersSnapshot = loadPaperOrders();
    const registrySnapshot = buildStrategyRegistry({
      entries: logSnapshot,
      orders: ordersSnapshot,
      riskProfile: deskSettings.riskProfile,
    });
    const deskMemory = buildClientMemoryPayload(
      logEntries,
      draftRules,
      loadPinnedNotes(),
      {
        incidents: loadIncidents(),
        councilSessions: loadCouncilSessions(),
        adaptationProposals: loadAdaptationProposals(),
        registryStrategies: registrySnapshot.strategies,
      },
    );
    const strategyRegistry = buildRegistryPayloadForAnalyze(registrySnapshot);
    const governance = buildGovernancePayloadForAnalyze({
      entries: logSnapshot,
      orders: ordersSnapshot,
      riskProfile: deskSettings.riskProfile,
    });
    const adaptiveWeighting = buildAdaptiveWeightingPayload({
      entries: logSnapshot,
      storedResults: loadEvaluationResults(),
    });

    const analyzeRequest = {
      macroView,
      macroEvent,
      deskMemory,
      ethQuote,
      deskRiskProfile: deskSettings.riskProfile,
      strategyRegistry,
      governance,
      adaptiveWeighting,
      ...derivativesOverrides,
      derivativesOverrides,
    };

    const postAnalyze = async (body: unknown) => {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...workspaceHeaders,
        },
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
          strategyRegistry,
          governance,
          adaptiveWeighting,
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
        await persistAnalysis(result, { isDemo: false });
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
      if (allowMockFallbackInCurrentMode()) {
        await persistAnalysis(getMockDashboardFallback(), { isDemo: true });
        setUsingFallback(true);
      }
    } finally {
      setLoading(false);
    }
  }, [
    macroView,
    logEntries,
    draftRules,
    persistAnalysis,
    controlsReady,
    canRunAnalysis,
    workspaceHeaders,
  ]);

  handleAnalyzeRef.current = handleAnalyze;

  const workerEnabled = loadClientWorkerSettings().workerEnabled;
  const backgroundWorker = useBackgroundWorker({
    enabled: logHydrated && workerEnabled,
  });

  const autopilot = useAutopilot({
    enabled: logHydrated && !workerEnabled,
    latestAnalysis: data,
    onBeforeAnalyze: async () => {
      await handleAnalyzeRef.current?.();
    },
  });

  autopilotRunRef.current = autopilot.runCycle;

  useEffect(() => {
    if (autopilot.lastRun || backgroundWorker.lastRun) {
      setActionQueue(loadOperatorActionQueue().filter((a) => a.status === "OPEN"));
    }
  }, [autopilot.lastRun, backgroundWorker.lastRun]);

  useEffect(() => {
    if (!logHydrated || initialAutopilotRef.current) return;
    initialAutopilotRef.current = true;
      void autopilot.runCycle().then(async (result) => {
      await writeDeskCycle({ autopilotResult: result ?? undefined });
      if (result) {
        setActionQueue(loadOperatorActionQueue().filter((a) => a.status === "OPEN"));
      }
    });
  }, [logHydrated, autopilot.runCycle]);

  const { secondsUntilRefresh, trigger } = useAutoDeskRefresh(handleAnalyze, {
    enabled: autoRefreshEnabled,
    intervalMs: refreshIntervalMs,
    ready: controlsReady,
  });

  const handleResolveOutcome = useCallback(
    (id: string, input: ResolveOutcomeInput) => {
      const result = resolveOutcome(id, input);
      refreshLog();
      paper.refresh();
      void paper.syncToServer();
      void syncJournalIfEnabled();
      void writeDeskCycle().then(() =>
        autopilotRunRef.current().then((run) => {
          if (run) {
            setActionQueue(loadOperatorActionQueue().filter((a) => a.status === "OPEN"));
          }
        }),
      );
      if (result?.draftRuleCreated) {
        refreshLog();
      }
      if (result) {
        void emitOutcomeResolved({
          verdict: result.entry.finalVerdict,
          outcomeLabel: input.outcomeLabel ?? "BREAKEVEN",
          pnlPct: result.entry.paperPnl ?? input.manualPnlPct ?? 0,
          notes: input.notes,
        });
      }
      setPersistStatus({
        ok: true,
        message: result
          ? `Outcome resolved · learning updated${result.draftRuleCreated ? " · draft rule created" : ""}.`
          : "Outcome already resolved or entry missing.",
      });
    },
    [resolveOutcome, refreshLog, paper, syncJournalIfEnabled],
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

  const activeProfile = getDeskProfile(workspace.activeProfileId);
  const modeEffects = getTradingOsModeEffects();
  const isPrivateView = workspace.viewMode === "private";
  const backbone = logHydrated ? loadDeskBackbone() : null;

  const analyzePolicy = useMemo(() => {
    if (!logHydrated) return null;
    return evaluatePolicy(
      buildPolicyInput({
        workspaceId: wsContext.id,
        userRole: role,
        environmentMode: wsSettings.tradingEnvironment,
        action: "RUN_ANALYSIS",
        latestAnalysis: data,
        governance: loadGovernanceState(),
        entries: logEntries,
        orders: paper.orders,
        riskProfile: loadDeskSettings().riskProfile,
        backboneHealthy: backbone?.health.healthy ?? true,
      }),
    );
  }, [
    logHydrated,
    wsContext.id,
    role,
    wsSettings.tradingEnvironment,
    data,
    logEntries,
    paper.orders,
    backbone?.health.healthy,
  ]);

  const policyBlocksAnalyze =
    analyzePolicy != null &&
    (analyzePolicy.decision === "BLOCK" || analyzePolicy.decision === "REQUIRE_MORE_DATA");

  const agentOsSettings = loadAgentOsSettings();
  const testnetConnected = wsSettings.tradingEnvironment === "TESTNET";
  const topQueueAction = actionQueue[0];

  const aiStatus = useAiStatusCard({ pollMs: 3000 });

  const agentOs = useAgentOs({
    observeOnly: agentOsSettings.observeOnly,
    autopilotEnabled: autopilot.settings.autopilotEnabled,
    paperAutopilotEnabled: autopilot.settings.paperAutopilotEnabled,
    shadowModeEnabled: autopilot.settings.shadowModeEnabled,
    testnetConnected,
    automationEnabled: autopilot.settings.autopilotEnabled || workerEnabled,
    testnetAllowAllSafe: agentOsSettings.testnetAllowAllSafe,
    testnetAllowAllExplicitlyEnabled: agentOsSettings.testnetAllowAllExplicitlyEnabled,
    currentAction:
      data?.tradingDesk?.committee?.finalVerdict != null
        ? `Committee verdict: ${data.tradingDesk.committee.finalVerdict}`
        : "Standing by for analysis",
    nextAction:
      topQueueAction?.title ??
      (testnetConnected ? "Review testnet preview or run desk cycle" : "Run AI analysis cycle"),
    goalProgressPct: backbone?.portfolio?.paperPnlPct ?? null,
    pendingAction: agentOsSettings.testnetAllowAllSafe ? null : null,
    linkedDecisionId: lastLogId,
  });

  const runBinancePreview = useCallback(async () => {
    setBinancePreviewBusy(true);
    setBinancePreviewMessage(null);
    try {
      const latestLog =
        logEntries[0] ??
        (lastLogId ? loadDecisionLog().find((e) => e.id === lastLogId) : null);
      const input = buildBinancePreviewInputFromAiSignal({
        data,
        decisionLogId: latestLog?.id ?? null,
      });
      const res = await fetch("/api/exchange/binance/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...workspaceHeaders },
        body: JSON.stringify(input),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Preview failed");
      enqueueBinanceTestnetPreview(body.preview);
      setBinancePreviewMessage(
        body.preview.blocked
          ? `Preview blocked — open /binance-testnet. ${body.preview.blockReasons[0] ?? ""}`
          : `Queued ${body.preview.symbol} ${body.preview.side} preview — execute on /binance-testnet with double confirm.`,
      );
    } catch (e) {
      setBinancePreviewMessage(
        e instanceof Error ? e.message : "Binance preview failed",
      );
    } finally {
      setBinancePreviewBusy(false);
    }
  }, [data, lastLogId, logEntries, workspaceHeaders]);

  const sendBinanceTestnetPreview = useCallback(() => {
    const perm = agentOs.checkPermission("CREATE_TESTNET_PREVIEW");
    if (perm.allowed) {
      void runBinancePreview();
      return;
    }
    if (perm.requiresPermission) {
      agentOs.requestPermission(
        "CREATE_TESTNET_PREVIEW",
        {
          action: "CREATE_TESTNET_PREVIEW",
          title: "Create testnet preview",
          why: "AI wants to stage a Binance testnet order from the current committee signal.",
          risk: "No order until you separately approve execute. Live remains locked.",
          expectedResult: "Preview queued for review on /binance-testnet.",
          linkedDecisionId: lastLogId,
          sessionSafe: true,
        },
        () => void runBinancePreview(),
      );
    }
  }, [agentOs, runBinancePreview, lastLogId]);

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
      profileLabel={activeProfile.name}
      environmentModeLabel={ENVIRONMENT_MODE_LABELS[workspace.environmentMode]}
      cockpitMode
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

      {persistStatus && (
        <p
          className={`rounded-lg border px-3 py-2 text-xs ${
            persistStatus.ok
              ? "border-emerald-800/50 bg-emerald-950/30 text-emerald-200"
              : "border-rose-800/50 bg-rose-950/30 text-rose-200"
          }`}
        >
          {persistStatus.message}
        </p>
      )}

      <AIStatusCard
        card={aiStatus.card}
        busy={aiStatus.busy}
        onLoopGuardAction={() => void aiStatus.refresh()}
      />

      <PermissionPrompt
        request={
          agentOs.pendingPrompt ?? {
            action: "EXECUTE_TESTNET_ORDER",
            title: "Permission required",
            why: "",
            risk: "",
            expectedResult: "",
          }
        }
        open={agentOs.promptOpen}
        onDecision={agentOs.handlePermissionDecision}
        busy={binancePreviewBusy}
      />

      <CommandCockpit
        data={data}
        autopilot={backgroundWorker.lastRun?.autopilotResult ?? autopilot.lastRun}
        backbone={backbone}
        actions={actionQueue}
        deskStatus={
          ((backgroundWorker.lastRun?.autopilotResult ?? autopilot.lastRun)?.deskStatus ??
            "CAUTION") as CommandCenterStatus
        }
        deskStatusReason={
          (backgroundWorker.lastRun?.autopilotResult ?? autopilot.lastRun)?.briefing ??
          "AI desk standing by — run first cycle to assess production readiness."
        }
        lastRunAt={
          backgroundWorker.lastRun?.completedAt ??
          autopilot.lastRun?.completedAt ??
          autopilot.settings.lastRunAt
        }
        nextRunAt={
          backgroundWorker.status?.nextRunAt ??
          autopilot.lastRun?.nextRunAt ??
          autopilot.settings.nextRunAt
        }
        autopilotMode={resolveEffectiveMode(autopilot.settings)}
        running={loading || autopilot.running || backgroundWorker.running}
        workerStatus={backgroundWorker.lastRun?.status ?? null}
        workerFailed={backgroundWorker.failedJobs.length}
        onRunCycle={() =>
          void (workerEnabled
            ? backgroundWorker.runCycle({ force: true })
            : autopilot.runCycle())
        }
        analyzeAllowed={canRunAnalysis && !policyBlocksAnalyze}
        policyResult={analyzePolicy}
        liveReadinessStatus={
          backbone?.risk.liveReadinessBlocked
            ? "FAIL"
            : backbone
              ? "PASS"
              : null
        }
        liveReadinessReady={backbone ? !backbone.risk.liveReadinessBlocked : false}
        liveReadinessBlockers={backbone?.risk.blockers ?? []}
        onRunAnalyze={() => void autopilot.runCycle({ triggerAnalyze: true })}
        onSendBinancePreview={() => void sendBinanceTestnetPreview()}
        binancePreviewBusy={binancePreviewBusy}
        binancePreviewMessage={binancePreviewMessage}
      />

      {data?.tradingDesk && (
        <div
          className={`flex flex-col gap-4 transition-opacity ${loading ? "pointer-events-none opacity-60" : ""}`}
          aria-busy={loading}
        >
          {paper.settings.paperMode === "RELAXED_PAPER" && (
            <p className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-[11px] font-semibold text-amber-200">
              Paper Relaxed — learning mode only · live execution blocked
            </p>
          )}
          <CockpitAdvancedDrawers
            drawers={[
              {
                id: "ai-status-technical",
                title: "AI status technical log",
                summary: `${aiStatus.card.progressPct}% · ${aiStatus.card.recentToolActions.length} events`,
                children: (
                  <AIStatusTechnicalLog events={aiStatus.card.recentToolActions} />
                ),
              },
              {
                id: "agent-os-matrix",
                title: "Agent OS permissions",
                summary: `${agentOs.state.modeLabel} · live locked`,
                children: (
                  <AgentOsMatrixPanel matrix={agentOs.matrix} />
                ),
              },
              {
                id: "agent-debate",
                title: "Agent debate",
                summary: "How the committee reached its verdict",
                children: (
                  <>
                    {isPrivateView ? (
                      <DeskNarratorPanel data={data} />
                    ) : (
                      <p className="text-xs text-zinc-500">
                        Enable private view in workspace settings to see full agent debate.
                      </p>
                    )}
                    <ul className="mt-3 space-y-1 text-xs text-zinc-400">
                      {(data.tradingDesk?.committee.topReasons ?? []).slice(0, 5).map((r) => (
                        <li key={r}>· {r}</li>
                      ))}
                    </ul>
                  </>
                ),
              },
              {
                id: "raw-market-data",
                title: "Raw market data",
                summary: `BTC $${data.step1_marketSnapshot.spotPrice.toLocaleString()}`,
                children: (
                  <DashboardView data={data} onMemoryPinsChange={() => trigger()} />
                ),
              },
              {
                id: "telegram-control",
                title: "Telegram control channel",
                summary: "Monitor & approve testnet from chat",
                children: <TelegramControlPanel />,
              },
              {
                id: "parallel-committee",
                title: "Parallel agent committee",
                summary: "Strategy · Risk · UX · Execution · Learning · Strategist",
                children: <ParallelReviewPanel />,
              },
              {
                id: "continuous-improvement",
                title: "Continuous improvement loop",
                summary: "Detect issues · committee · Cursor prompt · verify",
                children: <ContinuousImprovementPanel />,
              },
              {
                id: "second-brain",
                title: "Second brain memory graph",
                summary: aiStatus.card.memorySummary
                  ? `${aiStatus.card.memorySummary.lessonCount} lessons · ${aiStatus.card.memorySummary.subconsciousCount} stored`
                  : "Advisory memory",
                children: <SecondBrainPanel />,
              },
              {
                id: "strategy-signals",
                title: "Strategy signals",
                summary:
                  (data.tradingDesk?.strategySignals?.length ?? 0) > 0
                    ? `${data.tradingDesk?.strategySignals?.length} advisory signal(s)`
                    : "No approved signals",
                children: (
                  <StrategySignalPanel
                    signals={data.tradingDesk?.strategySignals}
                    notice={data.tradingDesk?.strategySignalsNotice}
                  />
                ),
              },
              {
                id: "risk-details",
                title: "Risk details",
                summary: data.tradingDesk?.committee.riskVeto
                  ? "Risk veto active"
                  : "Gates & committee",
                children: (
                  <div className="space-y-3 text-xs text-zinc-400">
                    <p>
                      Verdict: {data.tradingDesk?.committee.finalVerdict} · Risk veto:{" "}
                      {data.tradingDesk?.committee.riskVeto ? "Yes" : "No"}
                    </p>
                    <p>
                      Data trust: {data.dataTrust?.grade ?? "—"} ({data.dataTrust?.score ?? "—"}
                      /100)
                    </p>
                    <ul className="list-disc space-y-1 pl-4">
                      {(data.tradingDesk?.committee.topReasons ?? []).slice(0, 5).map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                    <a href="/command-center" className="text-rose-300 hover:underline">
                      Command center →
                    </a>
                  </div>
                ),
              },
              {
                id: "decision-timeline",
                title: "Decision timeline",
                summary: `${logEntries.length} session(s)`,
                children: (
                  <>
                    <DecisionLogPreview entries={logEntries} />
                    {modeEffects.allowOrderTickets && tradeControlEntry && (
                      <div className="mt-4 border-t border-zinc-800 pt-4">
                        <TradeControlPanel
                          data={data}
                          logEntry={tradeControlEntry}
                          onComplete={() => {
                            refreshLog();
                            paper.refresh();
                            setTradeControlEntry(
                              loadDecisionLog().find((e) => e.id === lastLogId) ?? null,
                            );
                          }}
                        />
                      </div>
                    )}
                    <p className="mt-3 text-[11px] text-zinc-600">
                      Full log, scoreboard, and paper tickets live on{" "}
                      <a href="/portfolio" className="text-teal-400 hover:underline">
                        Portfolio
                      </a>{" "}
                      and{" "}
                      <a href="/ledger" className="text-indigo-400 hover:underline">
                        Ledger
                      </a>
                      .
                    </p>
                  </>
                ),
              },
              {
                id: "automation-internals",
                title: "Automation internals",
                summary: "Sync, tests, operator tools",
                children: (
                  <>
                    {automation.lastRun && (
                      <p className="mb-3 text-xs text-cyan-200/80">
                        Last automation: {automation.lastRun.summary}
                      </p>
                    )}
                    <DataHealthPanel health={backbone?.health ?? null} />
                    {isPrivateView ? (
                      <div className="mt-4 space-y-4 border-t border-zinc-800 pt-4">
                        <OperatorDeskPanel
                          data={data}
                          lastLogId={lastLogId}
                          openPaperCount={paper.openOrders.length}
                          onRiskProfileChange={() => trigger()}
                        />
                        <ReplayDeskPanel entries={logEntries} />
                        <BacktestDeskPanel entries={logEntries} />
                        <TestAutomationPanel />
                        <DemoSeedPanel
                          onChanged={() => {
                            refreshLog();
                            paper.refresh();
                            void autopilot.runCycle();
                          }}
                        />
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-zinc-500">
                        Private workspace view unlocks operator tools and test panels.
                      </p>
                    )}
                    <label className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
                      <input
                        type="checkbox"
                        defaultChecked={loadDeskSettings().syncJournalSupabase}
                        onChange={(e) =>
                          saveDeskSettings({ syncJournalSupabase: e.target.checked })
                        }
                      />
                      Sync decision log to cloud after each session
                    </label>
                  </>
                ),
              },
            ]}
          />
        </div>
      )}
    </TradingDeskLayout>
  );
}
