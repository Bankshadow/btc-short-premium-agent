import type { BinanceStatusDiagnostics } from "@/lib/execution/binance-status-diagnostics";
import {
  normalizeBinanceStatusDiagnostics,
  resolveBinanceStatusConsistency,
} from "@/lib/execution/binance-status-diagnostics";
import type { BinanceTestnetStatus } from "@/lib/execution/binance-testnet-types";
import type { CoreHealthReport } from "./core-health";
import type { EvidenceProgress } from "@/lib/evidence/evidence-types";
import type { MissionSnapshot } from "@/lib/mission/mission-types";
import {
  getDefaultBinanceStatus,
  getDefaultCoreHealth,
  getDefaultEvidenceProjection,
  getDefaultMissionProjection,
  getDefaultPnlProjection,
  getDefaultPositionProjection,
  getDefaultRiskProjectionView,
  getDefaultTradeProjection,
  PROJECTION_FALLBACK_ACTIVE_MESSAGE,
  type DefaultBinanceStatus,
  type DefaultMissionProjection,
  type DefaultTradeProjection,
  type ProjectionSectionError,
} from "./projection-defaults";
import type { PnlProjection } from "./projections/pnl-projection";
import type { PositionProjection } from "./projections/position-projection";
import type { TradeProjection } from "./projections/trade-projection";
import type { RiskProjectionView } from "./projection-bundle-shared";
import {
  bundlePayloadReady,
  extractProjectionBundlePayload,
  type ProjectionBundlePayload,
} from "./projection-bundle-shape";

export interface NormalizedProjectionBundle {
  mission: DefaultMissionProjection;
  trades: DefaultTradeProjection;
  positions: PositionProjection;
  pnl: PnlProjection;
  evidence: EvidenceProgress;
  risk: RiskProjectionView;
  health: CoreHealthReport;
  binanceStatus: DefaultBinanceStatus;
  meta: { eventCount?: number; builtAt?: string; cacheKey?: string };
  isFallback: boolean;
  warnings: string[];
  errors: ProjectionSectionError[];
}

function normalizeMission(
  mission: MissionSnapshot,
  trades?: TradeProjection,
): DefaultMissionProjection {
  const base = getDefaultMissionProjection();
  const closedLen = trades?.closed?.length ?? 0;
  const openCount = trades?.effectiveOpenCount ?? trades?.open?.length ?? 0;
  const totalTrades = mission.totalTrades ?? closedLen ?? 0;
  return {
    ...base,
    ...mission,
    targetEquity: mission.targetCapital ?? base.targetEquity,
    totalTrades,
    openTrades: openCount,
    closedTrades: closedLen > 0 ? closedLen : (mission.totalTrades ?? 0),
    winCount: mission.win ?? base.winCount,
    lossCount: mission.loss ?? base.lossCount,
    breakevenCount: mission.breakeven ?? base.breakevenCount,
    zeroState: totalTrades <= 0 && closedLen <= 0,
  };
}

function normalizeTrades(
  trades: TradeProjection,
  mission?: MissionSnapshot,
): DefaultTradeProjection {
  const base = getDefaultTradeProjection();
  const open = trades.open ?? [];
  const closed = trades.closed ?? [];
  const openCount = trades.effectiveOpenCount ?? open.length;
  const closedCount = closed.length;
  const executionCount = mission?.totalTrades ?? openCount + closedCount;
  return {
    ...base,
    ...trades,
    open: open as DefaultTradeProjection["open"],
    closed: closed as DefaultTradeProjection["closed"],
    trades: open as DefaultTradeProjection["trades"],
    openTrades: open as DefaultTradeProjection["openTrades"],
    closedTrades: closed as DefaultTradeProjection["closedTrades"],
    openCount,
    closedCount,
    effectiveOpenCount: trades.effectiveOpenCount ?? openCount,
    totalTrades: executionCount,
    summary: {
      openCount,
      closedCount,
      realizedPnl: base.summary.realizedPnl,
      executionCount,
    },
    zeroState: executionCount <= 0 && closedCount <= 0 && open.length <= 0,
  };
}

export function normalizeBinanceStatusForUI(
  status: BinanceTestnetStatus | BinanceStatusDiagnostics | DefaultBinanceStatus,
): DefaultBinanceStatus {
  const normalized = normalizeBinanceStatusDiagnostics(
    resolveBinanceStatusConsistency(status as BinanceTestnetStatus),
    "mvp-4.6",
  );
  return {
    ...normalized,
    zeroState: false,
  };
}

export function normalizeProjectionBundle(
  raw: unknown,
  options?: {
    binanceStatus?: DefaultBinanceStatus;
    errors?: ProjectionSectionError[];
  },
): NormalizedProjectionBundle {
  const errors = options?.errors ?? [];
  const warnings: string[] = [];
  const payload = extractProjectionBundlePayload(raw);
  const baseBinance = normalizeBinanceStatusForUI(
    options?.binanceStatus ?? getDefaultBinanceStatus(),
  );

  if (!bundlePayloadReady(payload)) {
    warnings.push(PROJECTION_FALLBACK_ACTIVE_MESSAGE);
    if (!payload?.mission) warnings.push("mission missing in bundle response");
    if (!payload?.trades) warnings.push("trades missing in bundle response");
    return {
      mission: getDefaultMissionProjection(),
      trades: getDefaultTradeProjection(),
      positions: getDefaultPositionProjection(),
      pnl: getDefaultPnlProjection(),
      evidence: getDefaultEvidenceProjection(),
      risk: getDefaultRiskProjectionView(),
      health: getDefaultCoreHealth(),
      binanceStatus: baseBinance,
      meta: {},
      isFallback: true,
      warnings,
      errors,
    };
  }

  const mission = normalizeMission(payload!.mission!, payload!.trades);
  const trades = normalizeTrades(payload!.trades!, mission);

  return {
    mission,
    trades,
    positions: payload!.positions ?? getDefaultPositionProjection(),
    pnl: payload!.pnl ?? getDefaultPnlProjection(),
    evidence: payload!.evidence ?? getDefaultEvidenceProjection(),
    risk: payload!.risk
      ? { ...getDefaultRiskProjectionView(), ...payload!.risk, liveLocked: true }
      : getDefaultRiskProjectionView(),
    health: payload!.health ?? getDefaultCoreHealth(),
    binanceStatus: payload!.binanceStatus
      ? normalizeBinanceStatusForUI(payload!.binanceStatus)
      : baseBinance,
    meta: payload!.meta ?? {},
    isFallback: false,
    warnings,
    errors,
  };
}

export function normalizedBundleToClientResult(
  normalized: NormalizedProjectionBundle,
): import("./projection-defaults").DefaultProjectionBundle {
  return {
    mission: normalized.mission as import("./projection-defaults").DefaultMissionProjection,
    trades: normalized.trades as import("./projection-defaults").DefaultTradeProjection,
    positions: normalized.positions as import("./projection-defaults").DefaultPositionProjection,
    pnl: normalized.pnl as import("./projection-defaults").DefaultPnlProjection,
    evidence: normalized.evidence as import("./projection-defaults").DefaultEvidenceProjection,
    risk: normalized.risk,
    health: normalized.health,
    binanceStatus: normalized.binanceStatus,
    errors: normalized.errors,
    warnings: normalized.warnings,
    loadedAt: new Date().toISOString(),
    ok: !normalized.isFallback,
  };
}
