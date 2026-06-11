import { getLatestAnalysis } from "@/lib/analysis/analysis-runner";
import {
  deriveExecutionSafetyStatus,
  getLatestActivePreview,
  getLatestExecutionReview,
  countPreviews,
} from "@/lib/execution";
import {
  getLatestActiveClosePreview,
  getLatestCloseReviewSummary,
} from "@/lib/execution/close-preview-store";
import { normalizeBinanceStatusDiagnostics } from "@/lib/execution/binance-status-diagnostics";
import { getBinanceTestnetStatusBounded } from "@/lib/execution/binance-testnet-status";
import { computeReadyForMvp5 } from "@/lib/core/mvp5-readiness";
import { API_RESPONSE_BOUND_MS } from "@/lib/core/zero-state";
import { buildEnrichedTradeProjection } from "@/lib/core/build-enriched-trade-projection";
import { readCoreEvents } from "@/lib/core/event-store";
import { buildMissionProjection } from "@/lib/core/projections/mission-projection";
import { getReconciliationStatus } from "@/lib/positions/position-monitor";
import { buildPortfolioRiskView } from "@/lib/portfolio-risk/portfolio-risk-manager";
import { runEngineHealthCheck } from "@/lib/health/engine-health-check";
import { getLatestSwarmReport } from "@/lib/skills/mirofish-swarm/swarm-runner";
import { buildStrategyHealthView } from "@/lib/strategy/strategy-health";
import { isTestnetConfigured, RISK_POLICY } from "@/lib/risk/risk-gate";
import {
  zeroDashboardUiContext,
  type DashboardUiContext,
} from "@/lib/core/ui-context-zero";

export type { DashboardUiContext };
export { zeroDashboardUiContext };

function resolveNextAction(input: {
  binanceStatusCode: string;
  binanceRecommendation: string;
  openTradeCount: number;
  reconciliationStatus: string;
  executionSafetyStatus: string;
  latestPreview: { symbol: string; side: string } | null;
  latestVerdict: string | null;
}): string {
  if (input.binanceStatusCode === "MISSING_ENV") {
    return input.binanceRecommendation || "Configure Binance Testnet or run first AI cycle.";
  }
  if (input.openTradeCount > 0) {
    return input.reconciliationStatus === "BLOCKED"
      ? "Position reconciliation blocked — refresh positions and resolve warnings."
      : "Open position — refresh monitor and review reduce-only close when ready.";
  }
  if (input.latestPreview) {
    return input.executionSafetyStatus === "ready"
      ? "Preview ready — run execution safety review, then execute on testnet."
      : `Review ${input.latestPreview.symbol} ${input.latestPreview.side} preview — run execution safety review.`;
  }
  if (input.latestVerdict === "TRADE") {
    return "TRADE verdict recorded — preview may be blocked or expired.";
  }
  if (input.latestVerdict) {
    return `Latest verdict: ${input.latestVerdict}. No active preview.`;
  }
  return "Configure Binance Testnet or run first AI cycle.";
}

export async function buildDashboardUiContext(): Promise<DashboardUiContext> {
  const events = await readCoreEvents();
  const mission = buildMissionProjection(events);
  const trades = await buildEnrichedTradeProjection(events);
  const testnetConfigured = isTestnetConfigured();
  const binanceStatus = normalizeBinanceStatusDiagnostics(
    await getBinanceTestnetStatusBounded(API_RESPONSE_BOUND_MS),
    "mvp-4.6",
  );
  const latestPreview = await getLatestActivePreview();
  const previewCount = await countPreviews();
  const latestExecutionReview = latestPreview
    ? await getLatestExecutionReview(latestPreview.previewId)
    : await getLatestExecutionReview();
  const executionSafetyStatus = deriveExecutionSafetyStatus({
    preview: latestPreview,
    latestReview: latestExecutionReview,
  });
  const engineHealth = await runEngineHealthCheck();
  const strategyHealth = await buildStrategyHealthView();
  const swarmReport = await getLatestSwarmReport();
  const latestAnalysis = await getLatestAnalysis();
  const portfolioRisk = await buildPortfolioRiskView();
  const reconciliation = await getReconciliationStatus();
  const latestClosePreview = await getLatestActiveClosePreview(trades.open[0]?.tradeId);
  const closeReviewSummary = await getLatestCloseReviewSummary();
  const readiness = computeReadyForMvp5({
    binanceStatus,
    events,
    openTradeCount: trades.summary.openCount,
  });

  const nextAction = resolveNextAction({
    binanceStatusCode: binanceStatus.status,
    binanceRecommendation: binanceStatus.recommendation,
    openTradeCount: trades.summary.openCount,
    reconciliationStatus: reconciliation.status,
    executionSafetyStatus,
    latestPreview,
    latestVerdict: mission.latestVerdict,
  });

  return {
    sprint: "mvp-4.6",
    testnetConfigured,
    binanceStatus,
    riskPolicy: RISK_POLICY,
    nextAction,
    latestPreview,
    previewCount,
    latestPreviewStatus: latestPreview?.status ?? null,
    executionEnabled: true,
    latestExecutionReview,
    executionSafetyStatus,
    latestOpenTrade: trades.open[0] ?? null,
    latestPosition: trades.open[0]?.position ?? null,
    reconciliation,
    readyForMvp5: readiness.ready,
    readyForMvp5Message: readiness.message,
    latestClosePreview: latestClosePreview ?? null,
    latestCloseReview: closeReviewSummary.reviewedAt
      ? {
          allowed: closeReviewSummary.allowed === true,
          blocked: closeReviewSummary.allowed !== true,
          requiresDoubleConfirm: true,
          blockers: closeReviewSummary.blockerCodes.map((code) => ({
            code,
            message: code,
            requiredAction: "Resolve blocker.",
          })),
          warnings: [],
          closePreviewId: closeReviewSummary.closePreviewId,
          tradeId: trades.open[0]?.tradeId ?? trades.closed[0]?.tradeId ?? null,
          positionId: latestClosePreview?.positionId ?? null,
          decisionLogId:
            trades.open[0]?.decisionLogId ?? trades.closed[0]?.decisionLogId ?? null,
          runId: trades.open[0]?.runId ?? trades.closed[0]?.runId ?? null,
          environment: "TESTNET",
          reviewedAt: closeReviewSummary.reviewedAt,
          message:
            closeReviewSummary.allowed === true
              ? "Close safety review passed — reduce-only close enabled in MVP 5C."
              : "Resolve blockers before close execution (MVP 5C).",
        }
      : null,
    latestClosedTrade: trades.closed[0] ?? null,
    engineHealth,
    strategyHealth,
    swarmReport,
    latestRegime: latestAnalysis.regime ?? null,
    noTradeBlockReason: latestAnalysis.noTradeBlockReason ?? null,
    scenarioNote: latestAnalysis.scenarioNote ?? null,
    portfolioRiskStatus: portfolioRisk.status,
  };
}

export async function buildDashboardUiContextSafe(): Promise<DashboardUiContext> {
  try {
    return await buildDashboardUiContext();
  } catch {
    return zeroDashboardUiContext();
  }
}
