import type { CoreHealthReport } from "./core-health";
import type { EnrichedTradeProjection } from "./build-enriched-trade-projection";
import type { EvidenceProgress } from "@/lib/evidence/evidence-types";
import type { BinanceStatusDiagnostics } from "@/lib/execution/binance-status-diagnostics";
import {
  DEFAULT_BINANCE_FUTURES_TESTNET_BASE_URL,
  MISSING_BINANCE_CREDENTIALS_REASON,
  MISSING_BINANCE_CREDENTIALS_RECOMMENDATION,
} from "@/lib/execution/binance-testnet-config";
import type { MissionSnapshot } from "@/lib/mission/mission-types";
import { DEFAULT_START_CAPITAL, DEFAULT_TARGET_CAPITAL } from "@/lib/mission/mission-types";
import type { PnlProjection } from "./projections/pnl-projection";
import type { PositionProjection } from "./projections/position-projection";
import type { RiskProjection } from "./projections/risk-projection";
import type { RiskProjectionView } from "./projection-bundle-shared";

export const PROJECTION_FETCH_TIMEOUT_MS = 4_000;

export interface ZeroStateMeta {
  zeroState?: boolean;
}

export type DefaultMissionProjection = MissionSnapshot &
  ZeroStateMeta & {
    targetEquity: number;
    openTrades: number;
    closedTrades: number;
    winCount: number;
    lossCount: number;
    breakevenCount: number;
  };

export type DefaultTradeProjection = EnrichedTradeProjection &
  ZeroStateMeta & {
    trades: EnrichedTradeProjection["open"];
    openTrades: EnrichedTradeProjection["open"];
    closedTrades: EnrichedTradeProjection["closed"];
    totalTrades: number;
    openCount: number;
    closedCount: number;
  };

export type DefaultPositionProjection = PositionProjection &
  ZeroStateMeta & {
    positions: PositionProjection["snapshots"];
    openPositionCount: number;
    reconciliationStatus: "OK" | "WARNING" | "BLOCKED";
    message: string;
  };

export type DefaultPnlProjection = PnlProjection &
  ZeroStateMeta & {
    realizedPnl: number;
    unrealizedPnl: number;
    netPnl: number;
    latestResult: string | null;
  };

export type DefaultEvidenceProjection = EvidenceProgress &
  ZeroStateMeta & {
    validTrades: number;
    requiredTrades: number;
    progressPct: number;
    rejectedTrades: string[];
    readiness: string;
  };

export type DefaultRiskProjection = RiskProjection &
  ZeroStateMeta & {
    status: "SAFE" | "DEFENSIVE" | "BLOCKED";
    mode: "DEFENSIVE" | "CONSERVATIVE" | "NORMAL";
    blockers: string[];
    warnings: string[];
  };

export type DefaultCoreHealth = CoreHealthReport & ZeroStateMeta;

export type DefaultBinanceStatus = BinanceStatusDiagnostics & ZeroStateMeta;

export interface ProjectionSectionError {
  section: string;
  code: string;
  message: string;
}

export interface DefaultProjectionBundle {
  mission: DefaultMissionProjection;
  trades: DefaultTradeProjection;
  positions: DefaultPositionProjection;
  pnl: DefaultPnlProjection;
  evidence: DefaultEvidenceProjection;
  risk: RiskProjectionView & ZeroStateMeta;
  health: DefaultCoreHealth;
  binanceStatus: DefaultBinanceStatus;
  errors: ProjectionSectionError[];
  warnings: string[];
  loadedAt: string;
  ok: boolean;
}

export function getDefaultMissionProjection(): DefaultMissionProjection {
  return {
    generatedAt: new Date().toISOString(),
    startCapital: DEFAULT_START_CAPITAL,
    targetCapital: DEFAULT_TARGET_CAPITAL,
    targetEquity: DEFAULT_TARGET_CAPITAL,
    currentEquity: DEFAULT_START_CAPITAL,
    progressPct: 0,
    totalTrades: 0,
    openTrades: 0,
    closedTrades: 0,
    win: 0,
    winCount: 0,
    loss: 0,
    lossCount: 0,
    breakeven: 0,
    breakevenCount: 0,
    netPnl: 0,
    openPositions: 0,
    latestRunId: null,
    latestDecisionLogId: null,
    latestVerdict: null,
    latestConfidence: null,
    latestVerdictReasons: [],
    liveLocked: true,
    zeroState: true,
  };
}

export function getDefaultTradeProjection(): DefaultTradeProjection {
  return {
    open: [],
    closed: [],
    trades: [],
    openTrades: [],
    closedTrades: [],
    totalTrades: 0,
    openCount: 0,
    closedCount: 0,
    summary: {
      openCount: 0,
      closedCount: 0,
      realizedPnl: 0,
      executionCount: 0,
    },
    zeroState: true,
  };
}

export function getDefaultPositionProjection(): DefaultPositionProjection {
  return {
    openTradeCount: 0,
    openPositionCount: 0,
    snapshots: [],
    positions: [],
    reconciliationStatus: "OK",
    message: "No open positions",
    zeroState: true,
  };
}

export function getDefaultPnlProjection(): DefaultPnlProjection {
  return {
    realizedCount: 0,
    totalNetPnl: 0,
    realizedPnl: 0,
    unrealizedPnl: 0,
    netPnl: 0,
    latestResult: null,
    zeroState: true,
  };
}

export function getDefaultEvidenceProjection(): DefaultEvidenceProjection {
  return {
    valid: 0,
    required: 12,
    rejected: 0,
    trades: [],
    readinessStatus: "COLLECTING",
    message: "0/12 valid evidence trades collected.",
    validTrades: 0,
    requiredTrades: 12,
    progressPct: 0,
    rejectedTrades: [],
    readiness: "NOT_READY",
    zeroState: true,
  };
}

export function getDefaultRiskProjection(): DefaultRiskProjection {
  return {
    portfolioBlocksExecution: false,
    operatorKillSwitch: false,
    enginePaused: false,
    openPositions: 0,
    status: "SAFE",
    mode: "DEFENSIVE",
    blockers: [],
    warnings: [],
    zeroState: true,
  };
}

export function getDefaultRiskProjectionView(): RiskProjectionView & ZeroStateMeta {
  return { ...getDefaultRiskProjection(), liveLocked: true };
}

export function getDefaultCoreHealth(): DefaultCoreHealth {
  const lastCheckedAt = new Date().toISOString();
  return {
    status: "OK",
    eventJournalStatus: "OK",
    projectionStatus: "OK",
    lifecycleStatus: "OK",
    riskStatus: "SAFE",
    exchangeStatus: "DISCONNECTED",
    operatorStatus: "ACTIVE",
    safetyStatus: "OK",
    blockingIssues: [],
    warnings: [],
    lastCheckedAt,
    liveLocked: true,
    zeroState: true,
  };
}

export function getDefaultBinanceStatus(): DefaultBinanceStatus {
  return {
    status: "MISSING_ENV",
    testnetEnabled: false,
    liveEnabled: false,
    apiKeyPresent: false,
    apiSecretPresent: false,
    proxyEnabled: false,
    proxyUrlConfigured: false,
    serverTimeOk: false,
    lastCheckedAt: new Date().toISOString(),
    baseUrl: DEFAULT_BINANCE_FUTURES_TESTNET_BASE_URL,
    reason: MISSING_BINANCE_CREDENTIALS_REASON,
    recommendation: MISSING_BINANCE_CREDENTIALS_RECOMMENDATION,
    connected: false,
    liveLocked: true,
    manualExecuteOnly: true,
    autoExecuteEnabled: false,
    sprint: "mvp-4.6",
    zeroState: true,
  };
}

export function getDefaultProjectionBundle(): DefaultProjectionBundle {
  const loadedAt = new Date().toISOString();
  return {
    mission: getDefaultMissionProjection(),
    trades: getDefaultTradeProjection(),
    positions: getDefaultPositionProjection(),
    pnl: getDefaultPnlProjection(),
    evidence: getDefaultEvidenceProjection(),
    risk: getDefaultRiskProjectionView(),
    health: getDefaultCoreHealth(),
    binanceStatus: getDefaultBinanceStatus(),
    errors: [],
    warnings: [],
    loadedAt,
    ok: true,
  };
}

/** @deprecated Use getDefaultMissionProjection */
export const zeroMissionProjectionDefault = getDefaultMissionProjection;
/** @deprecated Use getDefaultTradeProjection */
export const zeroEnrichedTradeProjectionDefault = getDefaultTradeProjection;
/** @deprecated Use getDefaultPositionProjection */
export const zeroPositionProjectionDefault = getDefaultPositionProjection;
/** @deprecated Use getDefaultPnlProjection */
export const zeroPnlProjectionDefault = getDefaultPnlProjection;
/** @deprecated Use getDefaultEvidenceProjection */
export const zeroEvidenceProjectionDefault = getDefaultEvidenceProjection;
/** @deprecated Use getDefaultRiskProjectionView */
export const zeroRiskProjectionViewDefault = getDefaultRiskProjectionView;
/** @deprecated Use getDefaultCoreHealth */
export const zeroCoreHealthDefault = getDefaultCoreHealth;
/** @deprecated Use getDefaultBinanceStatus */
export const zeroBinanceStatusDefault = getDefaultBinanceStatus;
/** @deprecated Use getDefaultProjectionBundle */
export const zeroProjectionBundleDefaults = getDefaultProjectionBundle;
