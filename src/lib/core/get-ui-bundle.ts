import { cache } from "react";
import { getBinanceTestnetStatusBounded } from "@/lib/execution/binance-testnet-status";
import { buildProjectionBundle } from "./projection-bundle";
import type { ProjectionBundleResponse } from "./projection-bundle-shared";
import { normalizeBinanceStatusForUI, normalizeProjectionBundle } from "./normalize-projection-bundle";
import {
  getDefaultUiProjectionData,
  mapNormalizedToUiProjectionData,
  type UiProjectionData,
} from "./ui-projection-data";
import type { ProjectionSectionError } from "./projection-defaults";
import { API_RESPONSE_BOUND_MS } from "./zero-state";

export type UiBundle = UiProjectionData;

function builderPayload(bundle: Extract<ProjectionBundleResponse, { ok: true }>) {
  return {
    mission: bundle.mission,
    trades: bundle.trades,
    positions: bundle.positions,
    pnl: bundle.pnl,
    evidence: bundle.evidence,
    risk: bundle.risk,
    health: bundle.health,
    meta: bundle.meta,
  };
}

/** REAL_BUNDLE when builder returned mission/trades — never zero-state defaults. */
export function resolveUiBundleSource(
  bundle: ProjectionBundleResponse,
  normalized: ReturnType<typeof normalizeProjectionBundle>,
): UiProjectionData["source"] {
  if (!bundle.ok) return "FALLBACK";
  const totalTrades = bundle.mission.totalTrades ?? 0;
  const closedLen = bundle.trades.closed?.length ?? 0;
  const openLen = bundle.trades.open?.length ?? 0;
  if (totalTrades > 0 || closedLen > 0 || openLen > 0) return "REAL_BUNDLE";
  return normalized.isFallback ? "FALLBACK" : "REAL_BUNDLE";
}

async function loadUiBundle(): Promise<UiBundle> {
  const errors: ProjectionSectionError[] = [];

  try {
    const bundle = await buildProjectionBundle();

    if (!bundle.ok) {
      errors.push({
        section: "bundle",
        code: "BUILD_FAILED",
        message: bundle.error,
      });
      return getDefaultUiProjectionData();
    }

    let binanceStatus;
    try {
      binanceStatus = normalizeBinanceStatusForUI(
        await getBinanceTestnetStatusBounded(API_RESPONSE_BOUND_MS),
      );
    } catch (err) {
      errors.push({
        section: "binance",
        code: "STATUS_FAILED",
        message: err instanceof Error ? err.message : "Binance status unavailable",
      });
    }

    const normalized = normalizeProjectionBundle(builderPayload(bundle), { binanceStatus, errors });
    const source = resolveUiBundleSource(bundle, normalized);

    return mapNormalizedToUiProjectionData(normalized, {
      source,
      errors,
      warnings: normalized.warnings,
      loadedAt: bundle.meta?.builtAt ?? new Date().toISOString(),
    });
  } catch (err) {
    errors.push({
      section: "bundle",
      code: "BUILD_FAILED",
      message: err instanceof Error ? err.message : "Projection bundle build failed",
    });
    return getDefaultUiProjectionData();
  }
}

/** Server-safe loader — same projection builder as GET /api/core/projections/bundle. */
export const getUiBundle = cache(loadUiBundle);
