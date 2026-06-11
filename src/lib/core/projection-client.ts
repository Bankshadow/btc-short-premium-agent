import { fetchJson } from "@/lib/api/fetch-json";
import type { BinanceStatusDiagnostics } from "@/lib/execution/binance-status-diagnostics";
import type { CoreHealthReport } from "./core-health";
import type { EvidenceProgress } from "@/lib/evidence/evidence-types";
import type { MissionSnapshot } from "@/lib/mission/mission-types";
import type { EnrichedTradeProjection } from "./build-enriched-trade-projection";
import {
  getDefaultBinanceStatus,
  getDefaultCoreHealth,
  getDefaultEvidenceProjection,
  getDefaultMissionProjection,
  getDefaultPnlProjection,
  getDefaultPositionProjection,
  getDefaultProjectionBundle,
  getDefaultRiskProjectionView,
  getDefaultTradeProjection,
  PROJECTION_FALLBACK_ACTIVE_MESSAGE,
  PROJECTION_FETCH_TIMEOUT_MS,
  PROJECTION_UNAVAILABLE_MESSAGE,
  type DefaultEvidenceProjection,
  type DefaultMissionProjection,
  type DefaultPnlProjection,
  type DefaultPositionProjection,
  type DefaultProjectionBundle,
  type DefaultTradeProjection,
  type ProjectionSectionError,
} from "./projection-defaults";
import {
  type ProjectionBundleResponse,
  type RiskProjectionView,
  zeroProjectionBundle,
} from "./projection-bundle-shared";
import {
  isProjectionBundleLike,
  isValidProjectionData,
  unwrapApiData,
  unwrapProjectionData,
} from "./projection-api-response";
import type { PnlProjection } from "./projections/pnl-projection";
import type { TradeProjection } from "./projections/trade-projection";
import type { PositionProjection } from "./projections/position-projection";

export type { ProjectionBundleResponse };
export type ProjectionBundleClientResult = DefaultProjectionBundle;

export interface FetchWithTimeoutResult<T> {
  data: T;
  usedFallback: boolean;
  error: ProjectionSectionError | null;
}

export async function fetchWithTimeout<T>(
  url: string,
  fallback: T,
  timeoutMs = PROJECTION_FETCH_TIMEOUT_MS,
  options?: { useApiUnwrap?: boolean },
): Promise<FetchWithTimeoutResult<T>> {
  const section = url.split("/").filter(Boolean).pop() ?? "unknown";
  try {
    const json = await fetchJson<unknown>(url, { timeoutMs });
    const data = options?.useApiUnwrap
      ? unwrapApiData<T>(json)
      : unwrapProjectionData<T>(json);
    if (!isValidProjectionData(data)) {
      return {
        data: fallback,
        usedFallback: true,
        error: {
          section,
          code: "INVALID_SHAPE",
          message: `Invalid projection response from ${url}`,
        },
      };
    }
    return { data, usedFallback: false, error: null };
  } catch (err) {
    return {
      data: fallback,
      usedFallback: true,
      error: {
        section,
        code: "FETCH_FAILED",
        message: err instanceof Error ? err.message : `Fetch failed: ${url}`,
      },
    };
  }
}

function exchangeStatusToBinanceStatus(
  exchangeStatus: string | undefined,
  base: DefaultProjectionBundle["binanceStatus"],
): DefaultProjectionBundle["binanceStatus"] {
  if (!exchangeStatus || exchangeStatus === "DISCONNECTED" || exchangeStatus === "UNKNOWN") {
    return base;
  }
  if (exchangeStatus === "MISSING_ENV") {
    return { ...base, status: "MISSING_ENV", connected: false, zeroState: false };
  }
  return {
    ...base,
    status: exchangeStatus === "CONNECTED" ? "CONNECTED" : (exchangeStatus as typeof base.status),
    connected: exchangeStatus === "CONNECTED",
    testnetEnabled: true,
    zeroState: false,
  };
}

export async function getMissionProjection(
  timeoutMs = PROJECTION_FETCH_TIMEOUT_MS,
): Promise<MissionSnapshot> {
  return (await fetchWithTimeout(
    "/api/core/projections/mission",
    getDefaultMissionProjection(),
    timeoutMs,
  )).data;
}

export async function getTradeProjection(
  timeoutMs = PROJECTION_FETCH_TIMEOUT_MS,
): Promise<EnrichedTradeProjection> {
  return (await fetchWithTimeout(
    "/api/core/projections/trades",
    getDefaultTradeProjection(),
    timeoutMs,
  )).data;
}

export async function getPositionProjection(
  timeoutMs = PROJECTION_FETCH_TIMEOUT_MS,
): Promise<DefaultPositionProjection> {
  return (await fetchWithTimeout(
    "/api/core/projections/positions",
    getDefaultPositionProjection(),
    timeoutMs,
  )).data;
}

export async function getPnlProjection(
  timeoutMs = PROJECTION_FETCH_TIMEOUT_MS,
): Promise<PnlProjection> {
  return (await fetchWithTimeout(
    "/api/core/projections/pnl",
    getDefaultPnlProjection(),
    timeoutMs,
  )).data;
}

export async function getEvidenceProjection(
  timeoutMs = PROJECTION_FETCH_TIMEOUT_MS,
): Promise<EvidenceProgress> {
  return (await fetchWithTimeout(
    "/api/core/projections/evidence",
    getDefaultEvidenceProjection(),
    timeoutMs,
  )).data;
}

export async function getRiskProjection(
  timeoutMs = PROJECTION_FETCH_TIMEOUT_MS,
): Promise<RiskProjectionView> {
  return (await fetchWithTimeout(
    "/api/core/projections/risk",
    getDefaultRiskProjectionView(),
    timeoutMs,
  )).data;
}

export async function getCoreHealth(
  timeoutMs = PROJECTION_FETCH_TIMEOUT_MS,
): Promise<CoreHealthReport> {
  return (await fetchWithTimeout("/api/core/health", getDefaultCoreHealth(), timeoutMs)).data;
}

export async function getBinanceStatus(
  timeoutMs = PROJECTION_FETCH_TIMEOUT_MS,
): Promise<BinanceStatusDiagnostics> {
  return (await fetchWithTimeout("/api/binance/status", getDefaultBinanceStatus(), timeoutMs))
    .data;
}

/** @deprecated Use getBinanceStatus */
export const getBinanceStatusSafe = getBinanceStatus;

export type ProjectionBundleWithBinance = ProjectionBundleResponse & {
  binanceStatus?: BinanceStatusDiagnostics | null;
};

function normalizeMissionFromBundle(
  mission: MissionSnapshot,
  trades?: TradeProjection,
): DefaultMissionProjection {
  const base = getDefaultMissionProjection();
  const effectiveOpen =
    trades?.effectiveOpenCount ?? trades?.open?.length ?? mission.openPositions ?? 0;
  const closedCount = trades?.closed?.length ?? mission.totalTrades ?? 0;
  const hasMissionData =
    mission.totalTrades > 0 || mission.latestRunId != null || closedCount > 0;
  return {
    ...base,
    ...mission,
    targetEquity: mission.targetCapital,
    totalTrades: mission.totalTrades,
    openTrades: effectiveOpen,
    closedTrades: closedCount,
    winCount: mission.win,
    lossCount: mission.loss,
    breakevenCount: mission.breakeven,
    netPnl: mission.netPnl,
    zeroState:
      ("zeroState" in mission && Boolean((mission as { zeroState?: boolean }).zeroState)) ||
      !hasMissionData,
  };
}

function normalizeTradesFromBundle(trades: TradeProjection): DefaultTradeProjection {
  const open = (trades.open ?? []) as DefaultTradeProjection["open"];
  const closed = (trades.closed ?? []) as DefaultTradeProjection["closed"];
  const base = getDefaultTradeProjection();
  const openCount = trades.effectiveOpenCount ?? open.length;
  const hasTrades = open.length > 0 || closed.length > 0;
  return {
    ...base,
    ...trades,
    open,
    closed,
    staleOpenWarnings: trades.staleOpenWarnings ?? [],
    trades: open,
    openTrades: open,
    closedTrades: closed,
    totalTrades: openCount + closed.length,
    openCount,
    closedCount: closed.length,
    summary: {
      openCount,
      closedCount: closed.length,
      realizedPnl: base.summary.realizedPnl,
      executionCount: openCount + closed.length,
    },
    zeroState:
      ("zeroState" in trades && Boolean((trades as { zeroState?: boolean }).zeroState)) ||
      !hasTrades,
  };
}

function normalizePositionsFromBundle(positions: PositionProjection): DefaultPositionProjection {
  const base = getDefaultPositionProjection();
  return {
    ...base,
    ...positions,
    positions: positions.snapshots ?? base.positions,
    openPositionCount: positions.openTradeCount ?? base.openPositionCount,
    reconciliationStatus: base.reconciliationStatus,
    message: base.message,
    zeroState: "zeroState" in positions && Boolean((positions as { zeroState?: boolean }).zeroState),
  };
}

function normalizePnlFromBundle(pnl: PnlProjection): DefaultPnlProjection {
  const base = getDefaultPnlProjection();
  return {
    ...base,
    ...pnl,
    realizedPnl: pnl.totalNetPnl ?? base.realizedPnl,
    unrealizedPnl: base.unrealizedPnl,
    netPnl: pnl.totalNetPnl ?? base.netPnl,
    zeroState: "zeroState" in pnl && Boolean((pnl as { zeroState?: boolean }).zeroState),
  };
}

function normalizeEvidenceFromBundle(evidence: EvidenceProgress): DefaultEvidenceProjection {
  const base = getDefaultEvidenceProjection();
  return {
    ...base,
    ...evidence,
    validTrades: evidence.valid ?? base.validTrades,
    requiredTrades: evidence.required ?? base.requiredTrades,
    progressPct: base.progressPct,
    rejectedTrades: base.rejectedTrades,
    readiness: evidence.readinessStatus ?? base.readiness,
    zeroState: "zeroState" in evidence && Boolean((evidence as { zeroState?: boolean }).zeroState),
  };
}

interface BundleApiPayload {
  mission?: MissionSnapshot;
  trades?: TradeProjection;
  positions?: PositionProjection;
  pnl?: PnlProjection;
  evidence?: EvidenceProgress;
  risk?: RiskProjectionView;
  health?: CoreHealthReport | null;
}

function stripBundleEnvelope(raw: Record<string, unknown>): BundleApiPayload {
  const { ok: _ok, meta: _meta, error: _error, ...rest } = raw;
  return rest as BundleApiPayload;
}

function extractBundlePayload(raw: unknown): BundleApiPayload | null {
  if (raw == null || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (isProjectionBundleLike(record)) {
    return stripBundleEnvelope(record);
  }
  return null;
}

function mapBundlePayloadToClient(
  payload: BundleApiPayload,
  binanceStatus: DefaultProjectionBundle["binanceStatus"],
  errors: ProjectionSectionError[],
  bundleFetchFailed: boolean,
): ProjectionBundleClientResult {
  const base = getDefaultProjectionBundle();
  const warnings: string[] = [];

  for (const err of errors) {
    warnings.push(`${err.section}: ${err.message}`);
  }

  const health = payload.health ?? base.health;
  const resolvedBinance = !binanceStatus.zeroState
    ? binanceStatus
    : health?.exchangeStatus
      ? exchangeStatusToBinanceStatus(health.exchangeStatus, binanceStatus)
      : binanceStatus;

  const missionHasData =
    payload.mission != null &&
    (payload.mission.totalTrades > 0 ||
      payload.mission.latestRunId != null ||
      (payload.trades?.closed?.length ?? 0) > 0);
  const hasRealMission = missionHasData;

  return {
    mission: payload.mission
      ? normalizeMissionFromBundle(payload.mission, payload.trades)
      : base.mission,
    trades: payload.trades ? normalizeTradesFromBundle(payload.trades) : base.trades,
    positions: payload.positions ? normalizePositionsFromBundle(payload.positions) : base.positions,
    pnl: payload.pnl ? normalizePnlFromBundle(payload.pnl) : base.pnl,
    evidence: payload.evidence ? normalizeEvidenceFromBundle(payload.evidence) : base.evidence,
    risk: payload.risk ? { ...base.risk, ...payload.risk, liveLocked: true } : base.risk,
    health,
    binanceStatus: resolvedBinance,
    errors,
    warnings:
      bundleFetchFailed || !hasRealMission
        ? [PROJECTION_FALLBACK_ACTIVE_MESSAGE, PROJECTION_UNAVAILABLE_MESSAGE, ...warnings]
        : errors.length > 0
          ? warnings
          : warnings,
    loadedAt: new Date().toISOString(),
    ok: !bundleFetchFailed && hasRealMission,
  };
}

function fallbackProjectionBundle(
  errors: ProjectionSectionError[],
): ProjectionBundleClientResult {
  const bundle = getDefaultProjectionBundle();
  bundle.ok = false;
  bundle.errors = errors;
  bundle.warnings = [
    PROJECTION_UNAVAILABLE_MESSAGE,
    ...errors.map((e) => `${e.section}: ${e.message}`),
  ];
  bundle.loadedAt = new Date().toISOString();
  return bundle;
}

export async function getProjectionBundle(
  options?: { timeoutMs?: number; includeBinance?: boolean },
): Promise<ProjectionBundleClientResult> {
  const timeoutMs = options?.timeoutMs ?? PROJECTION_FETCH_TIMEOUT_MS;
  const base = getDefaultProjectionBundle();
  const errors: ProjectionSectionError[] = [];

  let bundlePayload: BundleApiPayload | null = null;
  let bundleFetchFailed = false;

  try {
    const json = await fetchJson<unknown>("/api/core/projections/bundle", { timeoutMs });
    bundlePayload = extractBundlePayload(unwrapApiData<unknown>(json));
    if (!bundlePayload?.mission) {
      bundleFetchFailed = true;
      errors.push({
        section: "bundle",
        code: "INVALID_SHAPE",
        message: "Bundle response missing mission projection",
      });
      bundlePayload = {
        mission: base.mission,
        trades: base.trades,
        positions: base.positions,
        pnl: base.pnl,
        evidence: base.evidence,
        risk: base.risk,
        health: base.health,
      };
    }
  } catch (err) {
    bundleFetchFailed = true;
    errors.push({
      section: "bundle",
      code: "FETCH_FAILED",
      message: err instanceof Error ? err.message : "Bundle fetch failed",
    });
    bundlePayload = {
      mission: base.mission,
      trades: base.trades,
      positions: base.positions,
      pnl: base.pnl,
      evidence: base.evidence,
      risk: base.risk,
      health: base.health,
    };
  }

  const binanceR =
    options?.includeBinance !== false
      ? await fetchWithTimeout("/api/binance/status", base.binanceStatus, timeoutMs)
      : { data: base.binanceStatus, usedFallback: false, error: null };

  if (binanceR.error) errors.push(binanceR.error);

  if (bundleFetchFailed && bundleRWouldBeOnlyFallback(bundlePayload)) {
    return fallbackProjectionBundle(errors);
  }

  return mapBundlePayloadToClient(
    bundlePayload!,
    binanceR.data,
    errors,
    bundleFetchFailed,
  );
}

function bundleRWouldBeOnlyFallback(payload: BundleApiPayload | null): boolean {
  if (!payload?.mission) return true;
  return "zeroState" in payload.mission && Boolean((payload.mission as { zeroState?: boolean }).zeroState);
}

export async function getProjectionBundleLegacy(
  options?: { timeoutMs?: number; includeBinance?: boolean },
): Promise<ProjectionBundleWithBinance> {
  const timeoutMs = options?.timeoutMs ?? PROJECTION_FETCH_TIMEOUT_MS;
  try {
    const result = await fetchWithTimeout<ProjectionBundleResponse>(
      "/api/core/projections/bundle",
      zeroProjectionBundle(),
      timeoutMs,
    );
    const bundle = result.data;
    if (!options?.includeBinance) return bundle;
    const binanceStatus = await getBinanceStatus(timeoutMs);
    return { ...bundle, binanceStatus };
  } catch {
    const zero = zeroProjectionBundle();
    return {
      ...zero,
      ok: false,
      error: "Bundle fetch failed",
      health: null,
      meta: { eventCount: 0, builtAt: new Date().toISOString(), cacheKey: "error" },
    };
  }
}
