import { normalizeBinanceStatusForUI, normalizeProjectionBundle, normalizedBundleToClientResult } from "./normalize-projection-bundle";
import { fetchJson } from "@/lib/api/fetch-json";
import { unwrapApiData } from "./projection-api-response";
import {
  getDefaultBinanceStatus,
  getDefaultProjectionBundle,
  PROJECTION_FALLBACK_ACTIVE_MESSAGE,
  PROJECTION_FETCH_TIMEOUT_MS,
  PROJECTION_UNAVAILABLE_MESSAGE,
  type ProjectionSectionError,
} from "./projection-defaults";
import { bundleProjectionReady } from "./ui-projection-bind";
import type { DefaultProjectionBundle } from "./projection-defaults";
import type { BinanceStatusDiagnostics } from "@/lib/execution/binance-status-diagnostics";

export type { NormalizedProjectionBundle } from "./normalize-projection-bundle";
export type ProjectionBundleClientResult = DefaultProjectionBundle;

export interface ProjectionBundleForUIResult {
  bundle: ProjectionBundleClientResult;
  normalized: ReturnType<typeof normalizeProjectionBundle>;
  isFallback: boolean;
  errors: ProjectionSectionError[];
  warnings: string[];
  debugSource: "REAL_BUNDLE" | "FALLBACK";
}

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
    const data = options?.useApiUnwrap ? unwrapApiData<T>(json) : (unwrapApiData<T>(json) ?? (json as T));
    if (data == null) {
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

function fallbackProjectionBundle(errors: ProjectionSectionError[]): ProjectionBundleClientResult {
  const normalized = normalizeProjectionBundle(null, { errors });
  const bundle = normalizedBundleToClientResult(normalized);
  bundle.ok = false;
  bundle.errors = errors;
  bundle.warnings = [
    PROJECTION_FALLBACK_ACTIVE_MESSAGE,
    PROJECTION_UNAVAILABLE_MESSAGE,
    ...errors.map((e) => `${e.section}: ${e.message}`),
  ];
  return bundle;
}

async function fetchBinanceStatusForUI(timeoutMs: number): Promise<{
  status: DefaultProjectionBundle["binanceStatus"];
  error: ProjectionSectionError | null;
}> {
  const fallback = getDefaultBinanceStatus();
  const result = await fetchWithTimeout<BinanceStatusDiagnostics>(
    "/api/binance/status",
    fallback,
    timeoutMs,
    { useApiUnwrap: true },
  );
  return {
    status: normalizeBinanceStatusForUI(result.data),
    error: result.error,
  };
}

export async function getProjectionBundle(
  options?: { timeoutMs?: number; includeBinance?: boolean },
): Promise<ProjectionBundleClientResult> {
  const result = await getProjectionBundleForUI(options);
  return result.bundle;
}

export async function getProjectionBundleForUI(
  options?: { timeoutMs?: number; includeBinance?: boolean },
): Promise<ProjectionBundleForUIResult> {
  const timeoutMs = options?.timeoutMs ?? PROJECTION_FETCH_TIMEOUT_MS;
  const errors: ProjectionSectionError[] = [];

  let raw: unknown;
  try {
    raw = await fetchJson<unknown>("/api/core/projections/bundle", { timeoutMs });
  } catch (err) {
    errors.push({
      section: "bundle",
      code: "FETCH_FAILED",
      message: err instanceof Error ? err.message : "Bundle fetch failed",
    });
    const bundle = fallbackProjectionBundle(errors);
    return {
      bundle,
      normalized: normalizeProjectionBundle(null, { errors }),
      isFallback: true,
      errors,
      warnings: bundle.warnings,
      debugSource: "FALLBACK",
    };
  }

  let binanceStatus = getDefaultBinanceStatus();
  if (options?.includeBinance !== false) {
    const binanceR = await fetchBinanceStatusForUI(timeoutMs);
    binanceStatus = binanceR.status;
    if (binanceR.error) errors.push(binanceR.error);
  }

  const normalized = normalizeProjectionBundle(raw, { binanceStatus, errors });
  const bundle = normalizedBundleToClientResult(normalized);
  bundle.errors = errors;
  if (normalized.isFallback) {
    bundle.warnings = [
      PROJECTION_FALLBACK_ACTIVE_MESSAGE,
      PROJECTION_UNAVAILABLE_MESSAGE,
      ...normalized.warnings,
      ...errors.map((e) => `${e.section}: ${e.message}`),
    ];
    bundle.ok = false;
  } else {
    bundle.warnings = [...normalized.warnings, ...errors.map((e) => `${e.section}: ${e.message}`)];
    bundle.ok = bundleProjectionReady(bundle);
  }

  const isFallback = normalized.isFallback || !bundleProjectionReady(bundle);

  return {
    bundle,
    normalized,
    isFallback,
    errors,
    warnings: isFallback
      ? bundle.warnings
      : bundle.warnings.filter(
          (w) => w !== PROJECTION_FALLBACK_ACTIVE_MESSAGE && w !== PROJECTION_UNAVAILABLE_MESSAGE,
        ),
    debugSource: isFallback ? "FALLBACK" : "REAL_BUNDLE",
  };
}

// Legacy section exports — delegate to normalized bundle fetch where applicable
export async function getBinanceStatus(timeoutMs = PROJECTION_FETCH_TIMEOUT_MS) {
  return (await fetchBinanceStatusForUI(timeoutMs)).status;
}

export const getBinanceStatusSafe = getBinanceStatus;

export async function getMissionProjection(timeoutMs = PROJECTION_FETCH_TIMEOUT_MS) {
  return (await getProjectionBundle({ timeoutMs, includeBinance: false })).mission;
}

export async function getTradeProjection(timeoutMs = PROJECTION_FETCH_TIMEOUT_MS) {
  return (await getProjectionBundle({ timeoutMs, includeBinance: false })).trades;
}

export async function getPositionProjection(timeoutMs = PROJECTION_FETCH_TIMEOUT_MS) {
  return (await getProjectionBundle({ timeoutMs, includeBinance: false })).positions;
}

export async function getPnlProjection(timeoutMs = PROJECTION_FETCH_TIMEOUT_MS) {
  return (await getProjectionBundle({ timeoutMs, includeBinance: false })).pnl;
}

export async function getEvidenceProjection(timeoutMs = PROJECTION_FETCH_TIMEOUT_MS) {
  return (await getProjectionBundle({ timeoutMs, includeBinance: false })).evidence;
}

export async function getRiskProjection(timeoutMs = PROJECTION_FETCH_TIMEOUT_MS) {
  return (await getProjectionBundle({ timeoutMs, includeBinance: false })).risk;
}

export async function getCoreHealth(timeoutMs = PROJECTION_FETCH_TIMEOUT_MS) {
  return (await getProjectionBundle({ timeoutMs, includeBinance: false })).health;
}

export async function getProjectionBundleLegacy(
  options?: { timeoutMs?: number; includeBinance?: boolean },
) {
  const bundle = await getProjectionBundle(options);
  return {
    ok: bundle.ok,
    mission: bundle.mission,
    trades: bundle.trades,
    positions: bundle.positions,
    pnl: bundle.pnl,
    evidence: bundle.evidence,
    risk: bundle.risk,
    health: bundle.health,
    meta: { eventCount: 0, builtAt: bundle.loadedAt, cacheKey: "client" },
    binanceStatus: bundle.binanceStatus,
  };
}

export type { ProjectionBundleResponse } from "./projection-bundle-shared";
