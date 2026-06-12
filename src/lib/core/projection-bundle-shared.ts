import type { CoreHealthReport } from "./core-health";
import type { EvidenceProgress } from "@/lib/evidence/evidence-types";
import type { MissionSnapshot } from "@/lib/mission/mission-types";
import { zeroMissionProjection } from "./projections/mission-projection";
import { zeroPnlProjection } from "./projections/pnl-projection";
import { zeroRiskProjection } from "./projections/risk-projection";
import { zeroTradeProjection } from "./projections/trade-projection";
import type { PnlProjection } from "./projections/pnl-projection";
import type { PositionProjection } from "./projections/position-projection";
import type { RiskProjection } from "./projections/risk-projection";
import type { TradeProjection } from "./projections/trade-projection";

export interface RiskProjectionView extends RiskProjection {
  liveLocked: true;
}

export interface ProjectionBundleMeta {
  eventCount: number;
  builtAt: string;
  cacheKey: string;
}

export interface ProjectionBundlePayload {
  ok: true;
  mission: MissionSnapshot;
  trades: TradeProjection;
  positions: PositionProjection;
  pnl: PnlProjection;
  evidence: EvidenceProgress;
  risk: RiskProjectionView;
  health: CoreHealthReport;
  meta: ProjectionBundleMeta;
}

export interface ProjectionBundleError {
  ok: false;
  error: string;
  mission: MissionSnapshot;
  trades: TradeProjection;
  positions: PositionProjection;
  pnl: PnlProjection;
  evidence: EvidenceProgress;
  risk: RiskProjectionView;
  health: null;
  meta: { eventCount: 0; builtAt: string; cacheKey: "error" };
}

export type ProjectionBundleResponse = ProjectionBundlePayload | ProjectionBundleError;

function zeroPositionForClient(): PositionProjection {
  return { openTradeCount: 0, snapshots: [] };
}

function zeroEvidenceForClient(): EvidenceProgress {
  return {
    valid: 0,
    validTrades: 0,
    required: 12,
    requiredTrades: 12,
    rejected: 0,
    rejectedTrades: 0,
    pending: 0,
    pendingTrades: 0,
    progressPct: 0,
    trades: [],
    rejectedList: [],
    pendingList: [],
    validTradeIds: [],
    latestValidatedAt: null,
    blockingReasons: [],
    warnings: [],
    readinessStatus: "NOT_READY",
    message: "0/12 valid evidence trades collected.",
    liveLocked: true,
  };
}

export function zeroProjectionBundle(): ProjectionBundlePayload {
  const builtAt = new Date().toISOString();
  return {
    ok: true,
    mission: zeroMissionProjection(),
    trades: zeroTradeProjection(),
    positions: zeroPositionForClient(),
    pnl: zeroPnlProjection(),
    evidence: zeroEvidenceForClient(),
    risk: { ...zeroRiskProjection(), liveLocked: true },
    health: {
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
      rawWarningCount: 0,
      lastCheckedAt: builtAt,
      liveLocked: true,
    },
    meta: { eventCount: 0, builtAt, cacheKey: "0:none" },
  };
}

export function projectionBundleError(message: string): ProjectionBundleError {
  const zero = zeroProjectionBundle();
  return {
    ok: false,
    error: message,
    mission: zero.mission,
    trades: zero.trades,
    positions: zero.positions,
    pnl: zero.pnl,
    evidence: zero.evidence,
    risk: zero.risk,
    health: null,
    meta: { eventCount: 0, builtAt: new Date().toISOString(), cacheKey: "error" },
  };
}
