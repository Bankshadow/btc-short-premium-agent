import { getLatestExecutionReview, getLatestPreview } from "@/lib/execution";
import { normalizeBinanceStatusDiagnostics } from "@/lib/execution/binance-status-diagnostics";
import { getBinanceTestnetStatusBounded } from "@/lib/execution/binance-testnet-status";
import { API_RESPONSE_BOUND_MS } from "@/lib/core/zero-state";
import { computeReadyForMvp5 } from "@/lib/core/mvp5-readiness";
import { getEvents } from "@/lib/journal/journal-query";
import { buildMissionSnapshot } from "@/lib/mission/mission-snapshot";
import { isTestnetConfigured, RISK_POLICY } from "@/lib/risk/risk-gate";
import {
  buildExecutionSafetyGateReport,
  type SafetyEventSummary,
} from "./execution-safety-report";
import { getTradesSummary } from "@/lib/trades/trade-query";
import {
  countClosePreviews,
  countClosePreviewBlockedEvents,
  countPositionClosed,
  countPositionMonitored,
  getLatestCloseReviewSummary,
} from "@/lib/execution/close-preview-store";
import { getEvidenceProgressView } from "@/lib/evidence/evidence-progress";
import { runEngineHealthCheck } from "@/lib/health/engine-health-check";
import { getAllLearningRecords, summarizeLearning } from "@/lib/learning/learning-store";
import { buildPnlSummary, getAllPnlRecords } from "@/lib/pnl/pnl-store";
import { buildStrategyHealthView } from "@/lib/strategy/strategy-health";
import { getLatestSwarmReport } from "@/lib/skills/mirofish-swarm/swarm-runner";
import { getLatestAnalysis } from "@/lib/analysis/analysis-runner";
import { buildAgentScoreboardView } from "@/lib/agents/agent-scoreboard";
import { getLatestRegimeClassification, retrieveRegimeMemory } from "@/lib/regime/regime-retrieval";
import { getLatestRuleEvaluation } from "@/lib/rules/rule-evaluator";
import { getAllImprovementProposals } from "@/lib/improvement/proposal-generator";
import { getStrategyVersionSnapshot } from "@/lib/versioning/strategy-version-store";
import { getReconciliationStatus } from "@/lib/positions/position-monitor";
import { getLatestBriefing } from "@/lib/briefing/daily-briefing";
import { buildPortfolioRiskView } from "@/lib/portfolio-risk/portfolio-risk-manager";
import { buildMicroLiveReadinessView } from "@/lib/live-readiness/readiness-evaluator";
import { getLatestAuditPack } from "@/lib/audit/audit-pack-generator";
import { getLiveSandboxStatus } from "@/lib/live-sandbox/live-dry-run";
import type { ReportsSummary, PortfolioRiskHistoryEntry } from "./reports-types";

const SAFETY_EVENT_TYPES = new Set([
  "EXECUTION_REVIEWED",
  "EXECUTE_BLOCKED",
  "DOUBLE_CONFIRM_REQUIRED",
  "PREVIEW_EXPIRED",
  "DUPLICATE_ORDER_BLOCKED",
  "KILL_SWITCH_BLOCKED",
]);

function extractBlockerCodes(payload: Record<string, unknown>): string[] {
  if (Array.isArray(payload.codes)) return payload.codes.map(String);
  if (Array.isArray(payload.blockers)) {
    return payload.blockers.map((b) =>
      typeof b === "string" ? b : String((b as { code?: string }).code ?? ""),
    );
  }
  return [];
}

function mapSafetyEvents(
  events: Awaited<ReturnType<typeof getEvents>>,
): SafetyEventSummary[] {
  return events
    .filter((e) => SAFETY_EVENT_TYPES.has(e.type))
    .slice(0, 5)
    .map((e) => ({
      eventId: e.eventId,
      type: e.type,
      timestamp: e.timestamp,
      previewId: e.previewId ?? null,
      runId: e.runId ?? null,
      decisionLogId: e.decisionLogId ?? null,
      blockerCodes: extractBlockerCodes(e.payload as Record<string, unknown>),
    }));
}

function mapPortfolioRiskHistory(
  events: Awaited<ReturnType<typeof getEvents>>,
): PortfolioRiskHistoryEntry[] {
  return events
    .filter((e) => e.type === "PORTFOLIO_RISK_EVALUATED")
    .slice(-10)
    .reverse()
    .map((e) => {
      const p = e.payload as {
        status?: string;
        issueCount?: number;
        blocksExecution?: boolean;
      };
      return {
        timestamp: e.timestamp,
        status: String(p.status ?? "UNKNOWN"),
        issueCount: Number(p.issueCount ?? 0),
        blocksExecution: Boolean(p.blocksExecution),
      };
    });
}

export async function buildReportsSummary(): Promise<ReportsSummary> {
  const events = await getEvents();
  const mission = buildMissionSnapshot(events);
  const latestPreview = await getLatestPreview();
  const latestReview = latestPreview
    ? await getLatestExecutionReview(latestPreview.previewId)
    : null;
  const recentSafetyEvents = mapSafetyEvents(events);
  const trades = await getTradesSummary();
  const binanceStatus = normalizeBinanceStatusDiagnostics(
    await getBinanceTestnetStatusBounded(API_RESPONSE_BOUND_MS),
    "mvp-4.6",
  );
  const reconciliation = await getReconciliationStatus();
  const readiness = computeReadyForMvp5({
    binanceStatus,
    events,
    openTradeCount: trades.summary.openCount,
  });
  const executionSafetyGate = buildExecutionSafetyGateReport({
    preview: latestPreview,
    latestReview,
    recentSafetyEvents,
  });

  const closeReviewSummary = await getLatestCloseReviewSummary();
  const closeSafetyStatus: ReportsSummary["positionStats"]["latestCloseSafetyStatus"] =
    closeReviewSummary.reviewedAt == null
      ? "NOT_REVIEWED"
      : closeReviewSummary.allowed === true
        ? "ALLOWED"
        : "BLOCKED";

  const evidence = await getEvidenceProgressView();
  const pnlRecords = await getAllPnlRecords();
  const pnlSummary = buildPnlSummary(pnlRecords);
  const learningRecords = await getAllLearningRecords();
  const learningSummary = summarizeLearning(learningRecords);
  const engineHealth = await runEngineHealthCheck();
  const strategyHealth = await buildStrategyHealthView();
  const swarmReport = await getLatestSwarmReport();
  const latestAnalysis = await getLatestAnalysis();
  const agentScoreboard = await buildAgentScoreboardView();
  const regime = await getLatestRegimeClassification();
  const regimeMemory = await retrieveRegimeMemory(regime ?? undefined);
  const ruleEvaluation = await getLatestRuleEvaluation();
  const improvements = await getAllImprovementProposals();
  const strategyVersions = await getStrategyVersionSnapshot();
  const latestBriefing = await getLatestBriefing();
  const portfolioRisk = await buildPortfolioRiskView();
  const portfolioRiskHistory = mapPortfolioRiskHistory(events);
  const microLiveReadiness = await buildMicroLiveReadinessView();
  const latestAuditPack = await getLatestAuditPack();
  const liveSandbox = await getLiveSandboxStatus();

  return {
    generatedAt: mission.generatedAt,
    sprint: "mvp-24",
    liveLocked: true,
    executionEnabled: false,
    mission,
    evidenceProgress: {
      valid: evidence.valid,
      required: evidence.required,
      invalid: evidence.rejected,
      readinessStatus: evidence.readinessStatus,
      trades: evidence.trades,
    },
    pnlSummary,
    learningSummary,
    learningCount: learningRecords.length,
    testnetConfigured: isTestnetConfigured(),
    binanceStatus,
    riskPolicy: RISK_POLICY,
    executionSafetyGate,
    executionStats: {
      executionCount: trades.summary.executionCount,
      openTradesCount: trades.summary.openCount,
    },
    positionStats: {
      openPositionsCount: trades.summary.openCount,
      monitoredPositionsCount: await countPositionMonitored(),
      closePreviewsCount: await countClosePreviews(),
      closePreviewBlockedCount: await countClosePreviewBlockedEvents(),
      closedPositionsCount: await countPositionClosed(),
      reconciliationStatus: reconciliation.status,
      latestCloseSafetyStatus: closeSafetyStatus,
      latestCloseReviewedAt: closeReviewSummary.reviewedAt,
      latestClosePreviewId: closeReviewSummary.closePreviewId,
      realizedPnlPending: pnlRecords.length < (await countPositionClosed()),
    },
    engineHealth,
    strategyHealth,
    swarmReport,
    analysisComparison: {
      verdict: latestAnalysis.verdict?.verdict ?? null,
      swarmSignal: swarmReport?.advisorySignal ?? null,
      swarmAgreement: latestAnalysis.swarmAgreement ?? null,
      scenarioNote: latestAnalysis.scenarioNote ?? null,
      noTradeBlockReason: latestAnalysis.noTradeBlockReason ?? null,
    },
    agentScoreboard,
    regime,
    regimeMemory,
    ruleEvaluation,
    improvements,
    strategyVersions,
    readyForMvp5: readiness.ready,
    readyForMvp5Message: readiness.message,
    latestBriefing,
    portfolioRisk,
    portfolioRiskHistory,
    microLiveReadiness,
    latestAuditPack,
    liveSandbox,
    legacy: {
      readiness: {
        status: "COLLECTING",
        message: "Legacy reference — Sprint 1 readiness checklist.",
        liveLocked: true as const,
      },
      strategyHealth: strategyHealth.message,
      riskBudget: "Testnet preview notional limits apply.",
    },
  };
}
