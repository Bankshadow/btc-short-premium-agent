import type { BinanceStatusDiagnostics } from "@/lib/execution/binance-status-diagnostics";
import type { OrderPreview } from "@/lib/execution/preview-types";
import type { ExecutionSafetyResult } from "@/lib/execution/execution-safety-types";
import type { ClosePreview } from "@/lib/execution/close-preview-types";
import type { EngineHealthReport } from "@/lib/health/engine-health-types";
import type { StrategyHealthReport } from "@/lib/strategy/strategy-types";
import type { ScenarioSwarmReport } from "@/lib/skills/mirofish-swarm/swarm-types";
import type { ReconciliationResult } from "@/lib/positions/position-types";
import type { PositionSnapshot } from "@/lib/positions/position-types";
import type { OpenTradeWithPosition } from "@/lib/trades/trade-query";
import type { ClosedTrade } from "@/lib/trades/trade-types";
import { getDefaultBinanceStatus } from "@/lib/core/projection-defaults";
import { ZERO_STATE_NEXT_ACTION } from "@/lib/core/zero-state";
import { RISK_POLICY, isTestnetConfigured } from "@/lib/risk/risk-gate";

/** Client-safe dashboard UI context shape (supplemental, non-projection). */
export interface DashboardUiContext {
  sprint: string;
  testnetConfigured: boolean;
  binanceStatus: BinanceStatusDiagnostics;
  riskPolicy: typeof RISK_POLICY;
  nextAction: string;
  latestPreview: OrderPreview | null;
  previewCount: number;
  latestPreviewStatus: string | null;
  executionEnabled: boolean;
  latestExecutionReview: ExecutionSafetyResult | null;
  executionSafetyStatus: string;
  latestOpenTrade: OpenTradeWithPosition | null;
  latestPosition: PositionSnapshot | null;
  reconciliation: ReconciliationResult;
  readyForMvp5: boolean;
  readyForMvp5Message: string | null;
  latestClosePreview: ClosePreview | null;
  latestCloseReview: {
    allowed: boolean;
    blocked: boolean;
    requiresDoubleConfirm: boolean;
    blockers: Array<{ code: string; message: string; requiredAction: string }>;
    warnings: string[];
    closePreviewId: string | null;
    tradeId: string | null;
    positionId: string | null;
    decisionLogId: string | null;
    runId: string | null;
    environment: "TESTNET";
    reviewedAt: string;
    message: string;
  } | null;
  latestClosedTrade: ClosedTrade | null;
  engineHealth: EngineHealthReport;
  strategyHealth: StrategyHealthReport;
  swarmReport: ScenarioSwarmReport | null;
  latestRegime: string | null;
  noTradeBlockReason: string | null;
  scenarioNote: string | null;
  portfolioRiskStatus: string;
}

export function zeroDashboardUiContext(): DashboardUiContext {
  const binanceStatus = getDefaultBinanceStatus();
  return {
    sprint: "mvp-4.6",
    testnetConfigured: isTestnetConfigured(),
    binanceStatus,
    riskPolicy: RISK_POLICY,
    nextAction: ZERO_STATE_NEXT_ACTION,
    latestPreview: null,
    previewCount: 0,
    latestPreviewStatus: null,
    executionEnabled: true,
    latestExecutionReview: null,
    executionSafetyStatus: "no_preview",
    latestOpenTrade: null,
    latestPosition: null,
    reconciliation: {
      status: "OK",
      issues: [],
      openTradeCount: 0,
      binancePositionCount: 0,
      lastMonitoredAt: null,
    },
    readyForMvp5: false,
    readyForMvp5Message: binanceStatus.recommendation,
    latestClosePreview: null,
    latestCloseReview: null,
    latestClosedTrade: null,
    engineHealth: {
      status: "OK",
      checkedAt: new Date().toISOString(),
      issues: [],
      orphanTrades: [],
      missingPnlTrades: [],
      stalePositionTrades: [],
      message: "Engine health OK.",
      blocksExecution: false,
    },
    strategyHealth: {
      generatedAt: new Date().toISOString(),
      totalClosedTrades: 0,
      evidenceTrades: 0,
      winRate: 0,
      averagePnl: 0,
      averageHoldMinutes: null,
      maxLoss: 0,
      bestSetup: null,
      worstSetup: null,
      invalidSetupCount: 0,
      advisoryOnly: true,
      liveLocked: true,
      message: "Strategy health is advisory only.",
    },
    swarmReport: null,
    latestRegime: null,
    noTradeBlockReason: null,
    scenarioNote: null,
    portfolioRiskStatus: "OK",
  };
}
