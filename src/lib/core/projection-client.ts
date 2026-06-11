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
  PROJECTION_FETCH_TIMEOUT_MS,
  type DefaultPositionProjection,
  type DefaultProjectionBundle,
  type ProjectionSectionError,
} from "./projection-defaults";
import {
  type ProjectionBundleResponse,
  type RiskProjectionView,
  zeroProjectionBundle,
} from "./projection-bundle-shared";
import {
  isValidProjectionData,
  unwrapProjectionData,
} from "./projection-api-response";
import type { PnlProjection } from "./projections/pnl-projection";

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
): Promise<FetchWithTimeoutResult<T>> {
  const section = url.split("/").filter(Boolean).pop() ?? "unknown";
  try {
    const json = await fetchJson<unknown>(url, { timeoutMs });
    const data = unwrapProjectionData<T>(json);
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

export async function getProjectionBundle(
  options?: { timeoutMs?: number; includeBinance?: boolean },
): Promise<ProjectionBundleClientResult> {
  const timeoutMs = options?.timeoutMs ?? PROJECTION_FETCH_TIMEOUT_MS;
  const base = getDefaultProjectionBundle();
  const errors: ProjectionSectionError[] = [];
  const warnings: string[] = [];

  const fetches = [
    fetchWithTimeout("/api/core/projections/mission", base.mission, timeoutMs),
    fetchWithTimeout("/api/core/projections/trades", base.trades, timeoutMs),
    fetchWithTimeout("/api/core/projections/positions", base.positions, timeoutMs),
    fetchWithTimeout("/api/core/projections/pnl", base.pnl, timeoutMs),
    fetchWithTimeout("/api/core/projections/evidence", base.evidence, timeoutMs),
    fetchWithTimeout("/api/core/projections/risk", base.risk, timeoutMs),
    fetchWithTimeout("/api/core/health", base.health, timeoutMs),
    options?.includeBinance !== false
      ? fetchWithTimeout("/api/binance/status", base.binanceStatus, timeoutMs)
      : Promise.resolve({ data: base.binanceStatus, usedFallback: false, error: null }),
  ] as const;

  const results = await Promise.all(fetches);

  for (const r of results) {
    if (r.error) {
      errors.push(r.error);
      warnings.push(`${r.error.section}: ${r.error.message}`);
    }
  }

  const [missionR, tradesR, positionsR, pnlR, evidenceR, riskR, healthR, binanceR] = results;

  return {
    mission: missionR.data,
    trades: tradesR.data,
    positions: positionsR.data,
    pnl: pnlR.data,
    evidence: evidenceR.data,
    risk: riskR.data,
    health: healthR.data,
    binanceStatus: binanceR.data,
    errors,
    warnings:
      errors.length > 0
        ? ["Projection unavailable. Showing safe zero-state.", ...warnings]
        : warnings,
    loadedAt: new Date().toISOString(),
    ok: errors.length === 0,
  };
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
