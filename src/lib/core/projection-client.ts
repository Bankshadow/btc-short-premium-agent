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
import {
  unwrapProjectionBundle,
  type ProjectionBundlePayload,
} from "./unwrap-projection-bundle";
import { bundleProjectionReady } from "./ui-projection-bind";
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
    zeroState: !hasMissionData,
  };
}

function normalizeTradesFromBundle(
  trades: TradeProjection,
  mission?: MissionSnapshot,
): DefaultTradeProjection {
  const open = (trades.open ?? []) as DefaultTradeProjection["open"];
  const closed = (trades.closed ?? []) as DefaultTradeProjection["closed"];
  const base = getDefaultTradeProjection();
  const openCount =
    trades.effectiveOpenCount ??
    ("openCount" in trades ? Number((trades as { openCount?: number }).openCount) : undefined) ??
    open.length;
  const closedLen = closed.length;
  const executionCount =
    mission?.totalTrades ??
    ("totalTrades" in trades ? Number((trades as { totalTrades?: number }).totalTrades) : undefined) ??
    openCount + closedLen;
  const hasTrades = executionCount > 0 || open.length > 0 || closedLen > 0;
  return {
    ...base,
    ...trades,
    open,
    closed,
    staleOpenWarnings: trades.staleOpenWarnings ?? [],
    trades: open,
    openTrades: open,
    closedTrades: closed,
    totalTrades: executionCount,
    openCount,
    closedCount: closedLen,
    effectiveOpenCount: trades.effectiveOpenCount ?? openCount,
    summary: {
      openCount,
      closedCount: closedLen,
      realizedPnl: base.summary.realizedPnl,
      executionCount,
    },
    zeroState: !hasTrades,
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
  const valid = evidence.valid ?? 0;
  const required = evidence.required ?? base.required;
  return {
    ...base,
    ...evidence,
    valid,
    required,
    validTrades: valid,
    requiredTrades: required,
    progressPct: required > 0 ? Math.round((valid / required) * 100) : 0,
    rejectedTrades: evidence.trades?.filter((t) => t.status === "REJECTED").map((t) => t.tradeId) ?? [],
    readiness: evidence.readinessStatus ?? base.readiness,
    zeroState: valid === 0 && (evidence.trades?.length ?? 0) === 0,
  };
}

interface BundleApiPayload extends ProjectionBundlePayload {}

function mapBundlePayloadToClient(
  payload: BundleApiPayload,
  binanceStatus: DefaultProjectionBundle["binanceStatus"],
  errors: ProjectionSectionError[],
  bundleValid: boolean,
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

  const mapped: ProjectionBundleClientResult = {
    mission: payload.mission
      ? normalizeMissionFromBundle(payload.mission, payload.trades)
      : base.mission,
    trades: payload.trades ? normalizeTradesFromBundle(payload.trades, payload.mission) : base.trades,
    positions: payload.positions ? normalizePositionsFromBundle(payload.positions) : base.positions,
    pnl: payload.pnl ? normalizePnlFromBundle(payload.pnl) : base.pnl,
    evidence: payload.evidence ? normalizeEvidenceFromBundle(payload.evidence) : base.evidence,
    risk: payload.risk ? { ...base.risk, ...payload.risk, liveLocked: true } : base.risk,
    health,
    binanceStatus: resolvedBinance,
    errors,
    warnings: bundleValid
      ? warnings
      : [PROJECTION_FALLBACK_ACTIVE_MESSAGE, PROJECTION_UNAVAILABLE_MESSAGE, ...warnings],
    loadedAt: new Date().toISOString(),
    ok: false,
  };

  mapped.ok = bundleValid && bundleProjectionReady(mapped);
  return mapped;
}

function fallbackProjectionBundle(
  errors: ProjectionSectionError[],
): ProjectionBundleClientResult {
  const bundle = getDefaultProjectionBundle();
  bundle.ok = false;
  bundle.errors = errors;
  bundle.warnings = [
    PROJECTION_FALLBACK_ACTIVE_MESSAGE,
    PROJECTION_UNAVAILABLE_MESSAGE,
    ...errors.map((e) => `${e.section}: ${e.message}`),
  ];
  bundle.loadedAt = new Date().toISOString();
  return bundle;
}

export interface ProjectionBundleForUIResult {
  bundle: ProjectionBundleClientResult;
  isFallback: boolean;
  errors: ProjectionSectionError[];
  warnings: string[];
}

function stripFallbackWarnings(warnings: string[]): string[] {
  return warnings.filter(
    (w) => w !== PROJECTION_FALLBACK_ACTIVE_MESSAGE && w !== PROJECTION_UNAVAILABLE_MESSAGE,
  );
}

/**
 * Primary UI entry point for projection bundle loading.
 * Valid when mission + trades exist in the API payload; fallback only on fetch/parse failure.
 */
export async function getProjectionBundleForUI(
  options?: { timeoutMs?: number; includeBinance?: boolean },
): Promise<ProjectionBundleForUIResult> {
  try {
    const bundle = await getProjectionBundle(options);
    const isFallback = !bundleProjectionReady(bundle);
    return {
      bundle,
      isFallback,
      errors: bundle.errors,
      warnings: isFallback
        ? bundle.warnings.length > 0
          ? bundle.warnings
          : [PROJECTION_FALLBACK_ACTIVE_MESSAGE]
        : stripFallbackWarnings(bundle.warnings),
    };
  } catch (err) {
    const errors: ProjectionSectionError[] = [
      {
        section: "bundle",
        code: "BUNDLE_FAILED",
        message: err instanceof Error ? err.message : "Projection bundle failed",
      },
    ];
    const bundle = fallbackProjectionBundle(errors);
    return {
      bundle,
      isFallback: true,
      errors,
      warnings: [PROJECTION_FALLBACK_ACTIVE_MESSAGE, PROJECTION_UNAVAILABLE_MESSAGE],
    };
  }
}

export async function getProjectionBundle(
  options?: { timeoutMs?: number; includeBinance?: boolean },
): Promise<ProjectionBundleClientResult> {
  const timeoutMs = options?.timeoutMs ?? PROJECTION_FETCH_TIMEOUT_MS;
  const base = getDefaultProjectionBundle();
  const errors: ProjectionSectionError[] = [];

  const bundleFetch = (async (): Promise<{
    payload: BundleApiPayload;
    valid: boolean;
  }> => {
    try {
      const json = await fetchJson<unknown>("/api/core/projections/bundle", { timeoutMs });
      const unwrapped = unwrapProjectionBundle(json);
      if (unwrapped.payload?.mission && unwrapped.payload?.trades) {
        return { payload: unwrapped.payload, valid: true };
      }
      errors.push({
        section: "bundle",
        code: unwrapped.usedFallback ? "INVALID_SHAPE" : "BUNDLE_INCOMPLETE",
        message: unwrapped.payload?.mission
          ? "Bundle response missing trades projection"
          : "Bundle response missing mission projection",
      });
      return {
        payload: unwrapped.payload ?? {
          mission: base.mission,
          trades: base.trades,
          positions: base.positions,
          pnl: base.pnl,
          evidence: base.evidence,
          risk: base.risk,
          health: base.health,
        },
        valid: false,
      };
    } catch (err) {
      errors.push({
        section: "bundle",
        code: "FETCH_FAILED",
        message: err instanceof Error ? err.message : "Bundle fetch failed",
      });
      return {
        payload: {
          mission: base.mission,
          trades: base.trades,
          positions: base.positions,
          pnl: base.pnl,
          evidence: base.evidence,
          risk: base.risk,
          health: base.health,
        },
        valid: false,
      };
    }
  })();

  const binanceFetch =
    options?.includeBinance !== false
      ? fetchWithTimeout("/api/binance/status", base.binanceStatus, timeoutMs)
      : Promise.resolve({ data: base.binanceStatus, usedFallback: false, error: null });

  const [bundleResult, binanceR] = await Promise.all([bundleFetch, binanceFetch]);

  if (binanceR.error) errors.push(binanceR.error);

  if (!bundleResult.valid) {
    return fallbackProjectionBundle(errors);
  }

  return mapBundlePayloadToClient(
    bundleResult.payload,
    binanceR.data,
    errors,
    true,
  );
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
