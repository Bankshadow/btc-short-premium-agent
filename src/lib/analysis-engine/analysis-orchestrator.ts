import { loadCronAnalysisInput } from "@/lib/cron/cron-config";
import { runAnalyzeRequest } from "@/lib/decision/run-analyze";
import { enrichAnalyzeWithMvp9 } from "@/lib/desk/enrich-analyze-mvp9";
import { runAutopilotCycle } from "@/lib/autopilot/run-autopilot";
import { DEFAULT_AUTOPILOT_SETTINGS } from "@/lib/autopilot/config";
import { buildCommandCenterServerContext } from "@/lib/command-center/server-context";
import {
  appendServerAnalysisFromResponse,
  loadServerAnalysisJournal,
} from "@/lib/journal/journal-server-store";
import {
  buildServerBackboneFromInput,
  writeServerBackboneRecord,
} from "@/lib/background-worker/server-backbone";
import { emitEngineEvent } from "@/lib/engine-event-bus/emit-engine-event";
import { probeBinanceStatus } from "@/lib/testnet-engine-activation/activation-probes";
import { resolveBinanceTestnetDiagnosticFromStatus } from "@/lib/testnet-engine-activation/build-binance-testnet-diagnostic";
import { buildOrderPreview } from "@/lib/exchange/binance";
import { buildBinancePreviewInputFromAiSignal } from "@/lib/exchange/binance/build-ai-preview";
import { buildMissionFlowServerSnapshot, writeMissionSnapshotCache } from "@/lib/mission-flow/build-server-snapshot";
import { recordMonitorEvent } from "@/lib/testnet-monitor/monitor-journal-server";
import { emitMissionAlert } from "@/lib/mission-notifications/emit-mission-alert";
import { listWarehouseRows } from "@/lib/db/repositories/warehouse-repository";
import { filterProductionEntries, filterProductionOrders } from "@/lib/journal/production-filter";
import type { DeskRun } from "@/lib/data-backbone/types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { PerpPaperPosition } from "@/lib/multi-asset/types";
import type { SecondBrainCycleSnapshot } from "@/lib/second-brain/types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import { buildAnalysisContext } from "./analysis-context-builder";
import { emitCentralAnalysisAuditEvents, newAnalysisRunId } from "./analysis-events";
import { resolveAnalysisAiState } from "./analysis-engine-registry";
import {
  persistCentralAnalysisRun,
  loadCentralAnalysisState,
} from "./analysis-engine-storage";
import { buildAnalysisLearningImpact } from "./analysis-learning-bridge";
import { buildAnalysisReportBridge } from "./analysis-report-bridge";
import { runAnalysisRiskGate } from "./analysis-risk-gate";
import {
  buildReportSummary,
  resolveConfidenceFromAnalysis,
  resolveFinalVerdictFromAnalysis,
  type AnalysisResult,
} from "./analysis-result";
import type { CentralAnalysisState } from "./analysis-state";
import {
  CENTRAL_ANALYSIS_ENGINE_LABEL,
  CENTRAL_ANALYSIS_ENGINE_MVP,
} from "./analysis-state";
import { attachAdvancedModulesToContext } from "@/lib/advanced-modules/attach-to-context";

export type CentralAnalysisTrigger =
  | "manual"
  | "start_ai"
  | "automation"
  | "api";

export interface CentralAnalysisRunInput {
  trigger?: CentralAnalysisTrigger;
  runId?: string;
  workspaceId?: string;
  riskProfile?: DeskRiskProfile;
  enrichMvp9?: boolean;
  runAutopilot?: boolean;
  createTestnetPreview?: boolean;
  secondBrain?: SecondBrainCycleSnapshot;
  secondBrainBullets?: string[];
  orders?: PaperOrder[];
  perpPositions?: PerpPaperPosition[];
}

export interface CentralAnalysisRunOutput {
  ok: boolean;
  runId: string;
  result: AnalysisResult;
  state: CentralAnalysisState;
  deskRun: DeskRun | null;
  journalStatus: "created" | "updated";
  error?: string;
}

export async function runCentralAnalysisOrchestrator(
  input: CentralAnalysisRunInput = {},
): Promise<CentralAnalysisRunOutput> {
  const runId = input.runId ?? newAnalysisRunId("cae");
  const riskProfile = input.riskProfile ?? "balanced";
  const trigger = input.trigger ?? "api";
  const enrichMvp9 =
    input.enrichMvp9 ?? (trigger === "start_ai" || trigger === "manual");
  const runAutopilot = input.runAutopilot ?? true;
  const createTestnetPreview = input.createTestnetPreview ?? true;

  await emitEngineEvent({
    type: "ANALYSIS_STARTED",
    runId,
    summary: `Analysis run started (${trigger}) · ${runId.slice(0, 16)}…`,
    meaningful: false,
  });

  const context = await buildAnalysisContext({ runId, riskProfile, orders: input.orders });

  const entriesRaw = await loadServerAnalysisJournal().catch(() => []);
  const entries = filterProductionEntries(entriesRaw);
  const orders =
    input.orders ??
    filterProductionOrders(
      (await listWarehouseRows("paper_trades", 500).catch(() => [])) as PaperOrder[],
    );

  const cronInput = await loadCronAnalysisInput();
  let analysis = await runAnalyzeRequest({
    ...cronInput,
    deskRiskProfile: riskProfile,
    strategyRegistry: context.strategyRegistry ?? undefined,
    governance: context.governance ?? undefined,
    secondBrain: input.secondBrain,
    secondBrainBullets: input.secondBrainBullets,
  } as Parameters<typeof runAnalyzeRequest>[0]);

  if (enrichMvp9) {
    analysis = await enrichAnalyzeWithMvp9(analysis);
  }

  const saved = await appendServerAnalysisFromResponse(analysis);
  let finalVerdict = resolveFinalVerdictFromAnalysis(analysis, saved.entry);
  const confidence = resolveConfidenceFromAnalysis(analysis);
  let riskGate = runAnalysisRiskGate({ context, analysis, finalVerdict });

  let autopilot = null;
  let deskRun: DeskRun | null = null;

  if (runAutopilot) {
    autopilot = await runAutopilotCycle({
      entries: [...entries.filter((e) => e.id !== saved.entry.id), saved.entry],
      orders,
      perpPositions: input.perpPositions ?? [],
      riskProfile,
      latestAnalysis: analysis,
      settings: {
        ...DEFAULT_AUTOPILOT_SETTINGS,
        autopilotEnabled: true,
        liveAutopilotEnabled: false,
        requireHumanApprovalForLive: true,
      },
      serverContext: await buildCommandCenterServerContext(),
    });

    const record = buildServerBackboneFromInput({
      entries: [...entries.filter((e) => e.id !== saved.entry.id), saved.entry],
      orders,
      perpPositions: input.perpPositions ?? [],
      riskProfile,
      autopilotResult: autopilot,
    });
    await writeServerBackboneRecord(record);
    deskRun = record.run ?? null;
  }

  const binanceStatus = await probeBinanceStatus();
  const diagnostic = resolveBinanceTestnetDiagnosticFromStatus(binanceStatus);
  const testnetConnected = diagnostic.connected;
  let testnetPreview = null;

  const blockers = [...riskGate.blockers];
  if (!testnetConnected) {
    if (finalVerdict === "TRADE") {
      finalVerdict = "WAIT";
    }
    const testnetReason = "Binance testnet not connected";
    if (!blockers.some((b) => b.toLowerCase().includes("testnet") || b.includes("Binance"))) {
      blockers.push(testnetReason);
    }
    riskGate = {
      ...riskGate,
      blockers,
      riskStatus: "BLOCKED",
      executionReady: false,
      humanActionRequired: true,
      nextAction: "Connect Binance Testnet",
    };
  }

  if (
    createTestnetPreview &&
    testnetConnected &&
    finalVerdict === "TRADE" &&
    blockers.length === 0
  ) {
    try {
      const previewInput = buildBinancePreviewInputFromAiSignal({
        data: analysis,
        decisionLogId: saved.entry.id,
      });
      testnetPreview = await buildOrderPreview(previewInput);
    } catch {
      testnetPreview = null;
    }
  }

  const learningImpact = buildAnalysisLearningImpact(context);
  const missionSnapshotForImpact = context.missionSnapshot;

  const partialResult = {
    finalVerdict,
    confidence,
    blockers,
    reasons: riskGate.reasons,
    missionImpact: {
      progressPct: missionSnapshotForImpact?.progressPct ?? null,
      evidenceCompleted: missionSnapshotForImpact?.evidenceProgress?.completedTrades ?? null,
      pendingLearning: learningImpact.pendingReviewCount,
    },
  };

  const reportBridge = buildAnalysisReportBridge({ context, result: partialResult });

  const result: AnalysisResult = {
    runId,
    decisionLogId: saved.entry.id,
    generatedAt: new Date().toISOString(),
    finalVerdict,
    confidence,
    tradeCandidate:
      finalVerdict === "TRADE"
        ? {
            symbol: testnetPreview?.symbol ?? "BTCUSDT",
            side: testnetPreview?.side ?? null,
            notionalUsd: testnetPreview?.notionalUsd ?? null,
            previewId: testnetPreview?.previewId ?? null,
            requiresDoubleConfirm: true,
          }
        : null,
    riskStatus: riskGate.riskStatus,
    blockers,
    reasons: riskGate.reasons,
    nextAction: testnetConnected ? riskGate.nextAction : "Connect Binance Testnet",
    humanActionRequired: testnetConnected ? riskGate.humanActionRequired : true,
    aiState: "ANALYZING",
    missionImpact: partialResult.missionImpact,
    reportSummary: reportBridge.reportSummary,
    learningImpact,
    auditEvents: [],
    liveTradingLocked: true,
    autoExecuteBlocked: true,
    analyzeResponse: analysis,
    journalEntry: saved.entry,
    autopilot: autopilot ?? undefined,
    testnetPreview,
    context,
  };

  result.context = await attachAdvancedModulesToContext({
    context,
    latestResult: result,
  });

  const freshMission = (
    await buildMissionFlowServerSnapshot({ fresh: true }).catch(() => null)
  )?.snapshot;
  if (freshMission) {
    const { toAnalysisContextConsistencyLink } = await import(
      "@/lib/engine-consistency/build-engine-consistency"
    );
    result.context = {
      ...result.context,
      missionSnapshot: freshMission,
      consistency: toAnalysisContextConsistencyLink(freshMission.engineConsistency),
    };
    writeMissionSnapshotCache(freshMission);
  }

  const { attachEvidenceQualityToContext } = await import(
    "@/lib/evidence-quality/attach-to-context"
  );
  result.context = await attachEvidenceQualityToContext(result.context);

  result.aiState = resolveAnalysisAiState({ result, context: result.context });

  const previousBlockers = context.validation.blockers;

  const auditEvents = await emitCentralAnalysisAuditEvents({
    runId,
    result,
    analysis,
    context: result.context,
    autopilot,
    previewCreated: Boolean(testnetPreview),
    previousBlockers,
  });
  result.auditEvents = auditEvents;

  await recordMonitorEvent({
    exchange: "BINANCE",
    environment: "TESTNET",
    eventType: "CENTRAL_ANALYSIS_COMPLETED",
    symbol: result.tradeCandidate?.symbol ?? null,
    decisionLogId: saved.entry.id,
    orderId: null,
    positionId: null,
    payload: {
      runId,
      trigger,
      finalVerdict,
      confidence,
      blockers: blockers.slice(0, 5),
      previewId: testnetPreview?.previewId ?? null,
      advisoryOnly: true,
      liveTradingLocked: true,
    },
  }).catch(() => undefined);

  const state: CentralAnalysisState = {
    mvp: CENTRAL_ANALYSIS_ENGINE_MVP,
    label: CENTRAL_ANALYSIS_ENGINE_LABEL,
    latestRunId: runId,
    latestDecisionLogId: saved.entry.id,
    latestResultAt: result.generatedAt,
    context: result.context,
    liveTradingLocked: true,
    lastUpdatedAt: new Date().toISOString(),
  };

  await persistCentralAnalysisRun({ state, result, auditEvents });

  void emitMissionAlert({
    kind: "cycle_complete",
    title: "Central analysis complete",
    body: `${reportBridge.reportSummary} · run ${runId.slice(0, 12)}…`,
  }).catch(() => undefined);

  if (finalVerdict === "TRADE") {
    void emitMissionAlert({
      kind: "trade_verdict",
      title: "TRADE verdict — review required",
      body: testnetPreview
        ? `${testnetPreview.symbol} ${testnetPreview.side} preview ready · double confirm on Dashboard.`
        : "No testnet preview — check readiness blockers.",
    }).catch(() => undefined);
  }

  return {
    ok: true,
    runId,
    result,
    state,
    deskRun,
    journalStatus: saved.status,
  };
}

export async function loadCentralAnalysisBundle() {
  const [state, latest, events] = await Promise.all([
    loadCentralAnalysisState(),
    import("./analysis-engine-storage").then((m) => m.loadLatestCentralAnalysisResult()),
    import("./analysis-engine-storage").then((m) => m.loadCentralAnalysisEvents()),
  ]);
  return { state, latest, events };
}
