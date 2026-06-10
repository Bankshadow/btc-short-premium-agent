import type { BinanceStatusDiagnostics } from "@/lib/execution/binance-status-diagnostics";
import {
  DEFAULT_BINANCE_FUTURES_TESTNET_BASE_URL,
  MISSING_BINANCE_CREDENTIALS_REASON,
  MISSING_BINANCE_CREDENTIALS_RECOMMENDATION,
} from "@/lib/execution/binance-testnet-config";
import type { BinanceTestnetStatus } from "@/lib/execution/binance-testnet-types";
import { normalizeBinanceStatusDiagnostics } from "@/lib/execution/binance-status-diagnostics";
import { buildMissionSnapshot } from "@/lib/mission/mission-snapshot";
import {
  DEFAULT_START_CAPITAL,
  DEFAULT_TARGET_CAPITAL,
  type MissionSnapshot,
} from "@/lib/mission/mission-types";
import { RISK_POLICY, isTestnetConfigured } from "@/lib/risk/risk-gate";
import { buildExecutionSafetyGateReport } from "@/lib/reports/execution-safety-report";
import type { ReportsSummary } from "@/lib/reports/reports-types";
import type { MissionSnapshotView } from "@/types/mission";
import type { Mvp5Readiness } from "./mvp5-readiness";

export const ZERO_STATE_NEXT_ACTION =
  "Configure Binance Testnet or run first AI cycle.";

export const API_RESPONSE_BOUND_MS = 5000;

export function defaultBinanceTestnetStatus(
  partial?: Partial<BinanceTestnetStatus>,
): BinanceTestnetStatus {
  const config = {
    apiKeyPresent: Boolean(process.env.BINANCE_API_KEY?.trim()),
    apiSecretPresent: Boolean(process.env.BINANCE_API_SECRET?.trim()),
    proxyEnabled:
      process.env.BINANCE_PROXY_ENABLED?.trim().toLowerCase() === "true" ||
      process.env.BINANCE_PROXY_ENABLED?.trim() === "1",
    proxyUrlConfigured: Boolean(
      process.env.BINANCE_PROXY_URL?.trim() ||
        process.env.BINANCE_TESTNET_PROXY_URL?.trim(),
    ),
  };

  let status: BinanceTestnetStatus["status"] = "MISSING_ENV";
  let reason = MISSING_BINANCE_CREDENTIALS_REASON;
  let recommendation = MISSING_BINANCE_CREDENTIALS_RECOMMENDATION;

  if (!isTestnetConfigured()) {
    reason = "BINANCE_TESTNET_ENABLED is not true.";
    recommendation = "Set BINANCE_TESTNET_ENABLED=true in server env.";
  } else if (!config.apiKeyPresent || !config.apiSecretPresent) {
    status = "MISSING_ENV";
  }

  return {
    status,
    testnetEnabled: isTestnetConfigured(),
    liveEnabled: process.env.BINANCE_LIVE_ENABLED?.trim().toLowerCase() === "true",
    apiKeyPresent: config.apiKeyPresent,
    apiSecretPresent: config.apiSecretPresent,
    proxyEnabled: config.proxyEnabled,
    proxyUrlConfigured: config.proxyUrlConfigured,
    serverTimeOk: false,
    lastCheckedAt: new Date().toISOString(),
    reason,
    recommendation,
    ...partial,
    baseUrl: partial?.baseUrl?.trim() || DEFAULT_BINANCE_FUTURES_TESTNET_BASE_URL,
  };
}

export function defaultBinanceDiagnostics(
  partial?: Partial<BinanceTestnetStatus>,
): BinanceStatusDiagnostics {
  return normalizeBinanceStatusDiagnostics(
    defaultBinanceTestnetStatus(partial),
    "mvp-4.6",
  );
}

export function zeroMissionSnapshot(): MissionSnapshot {
  return buildMissionSnapshot([]);
}

export function zeroTradesResponse() {
  return {
    open: [] as never[],
    closed: [] as never[],
    summary: {
      openCount: 0,
      closedCount: 0,
      realizedPnl: 0,
      executionCount: 0,
    },
    sprint: "mvp-4.6",
  };
}

export function zeroAnalysisLatest() {
  return {
    runId: null,
    decisionLogId: null,
    verdict: null,
    previewId: null,
    scenarioContext: null,
    swarmAgreement: null,
    scenarioNote: null,
    regime: null,
    noTradeBlockReason: null,
    strategyVersionId: null,
  };
}

export function zeroJournalEventsResponse() {
  return { events: [] as never[], total: 0 };
}

export function zeroMissionSnapshotView(
  readiness: Mvp5Readiness,
  binanceStatus?: BinanceStatusDiagnostics,
): MissionSnapshotView {
  const mission = zeroMissionSnapshot();
  const binance = binanceStatus ?? defaultBinanceDiagnostics();

  return {
    ...mission,
    sprint: "mvp-4.6",
    testnetConfigured: isTestnetConfigured(),
    binanceStatus: binance,
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
    executionCount: 0,
    readyForMvp5: readiness.ready,
    readyForMvp5Message: readiness.message,
    evidenceProgress: { valid: 0, required: 12, invalid: 0 },
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
  };
}

export function zeroReportsSummary(readiness: Mvp5Readiness): ReportsSummary {
  const mission = zeroMissionSnapshot();
  const binanceStatus = defaultBinanceDiagnostics();

  return {
    generatedAt: mission.generatedAt,
    sprint: "mvp-4.6",
    liveLocked: true,
    executionEnabled: false,
    mission,
    evidenceProgress: { valid: 0, required: 12, invalid: 0, readinessStatus: "COLLECTING", trades: [] },
    pnlSummary: {
      count: 0,
      wins: 0,
      losses: 0,
      breakeven: 0,
      totalNetPnl: 0,
      averagePnl: 0,
      bestTrade: null,
      worstTrade: null,
    },
    learningSummary: {
      count: 0,
      latestLessons: [],
      repeatedMistakes: [],
      repeatedStrengths: [],
    },
    learningCount: 0,
    testnetConfigured: isTestnetConfigured(),
    binanceStatus,
    riskPolicy: RISK_POLICY,
    executionSafetyGate: buildExecutionSafetyGateReport({
      preview: null,
      latestReview: null,
      recentSafetyEvents: [],
    }),
    executionStats: { executionCount: 0, openTradesCount: 0 },
    positionStats: {
      openPositionsCount: 0,
      monitoredPositionsCount: 0,
      closePreviewsCount: 0,
      closePreviewBlockedCount: 0,
      closedPositionsCount: 0,
      reconciliationStatus: "OK",
      latestCloseSafetyStatus: "NOT_REVIEWED",
      latestCloseReviewedAt: null,
      latestClosePreviewId: null,
      realizedPnlPending: false,
    },
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
    analysisComparison: {
      verdict: null,
      swarmSignal: null,
      swarmAgreement: null,
      scenarioNote: null,
      noTradeBlockReason: null,
    },
    agentScoreboard: {
      generatedAt: new Date().toISOString(),
      agents: [],
      advisoryOnly: true,
      liveLocked: true,
      message: "No agent scores yet.",
    },
    regime: null,
    regimeMemory: {
      currentRegime: "UNKNOWN",
      similarTrades: [],
      lessons: [],
      retrievedAt: new Date().toISOString(),
    },
    ruleEvaluation: null,
    improvements: [],
    strategyVersions: { versions: [], activeVersion: null, liveLocked: true },
    readyForMvp5: readiness.ready,
    readyForMvp5Message: readiness.message,
    latestBriefing: null,
    portfolioRisk: {
      status: "OK",
      evaluatedAt: new Date().toISOString(),
      issues: [],
      blocksExecution: false,
      dailyPnl: 0,
      drawdownPct: 0,
      openExposureUsd: 0,
      openPositions: 0,
      consecutiveLosses: 0,
      cooldownUntil: null,
      message: "Portfolio risk OK.",
      liveLocked: true,
    },
    portfolioRiskHistory: [],
    microLiveReadiness: {
      status: "NOT_READY",
      evaluatedAt: new Date().toISOString(),
      criteria: [],
      gaps: ["12 valid evidence trades"],
      recommendation: "NOT_READY",
      liveLocked: true,
      operatorApprovalPending: false,
    },
    latestAuditPack: null,
    liveSandbox: {
      liveLocked: true,
      liveEnvPresent: false,
      liveEnvDisabledByPolicy: true,
      policyLocked: true,
      lastPreflightAt: null,
      lastDryRunAt: null,
      blockers: ["LIVE_LOCKED_BY_POLICY"],
      message: "Micro-live sandbox is dry-run only. No real orders.",
    },
    legacy: {
      readiness: {
        status: "COLLECTING",
        message: "Zero-state — configure Binance Testnet or run first AI cycle.",
        liveLocked: true,
      },
      strategyHealth: "Not evaluated — awaiting testnet configuration.",
      riskBudget: "Testnet preview notional limits apply.",
    },
  };
}

export function zeroBinanceStatusApiResponse() {
  const killSwitch = { active: false, reason: null as string | null };
  return {
    ...defaultBinanceDiagnostics(),
    killSwitch,
    limits: { maxNotionalUsd: 50, allowedSymbols: ["BTCUSDT"] },
    riskPolicy: RISK_POLICY,
  };
}

export function formatDash(value: string | null | undefined): string {
  return value && value.length > 0 ? value : "—";
}

export { DEFAULT_START_CAPITAL, DEFAULT_TARGET_CAPITAL };
