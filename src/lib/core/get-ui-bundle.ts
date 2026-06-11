import { cache } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { getBinanceTestnetStatusBounded } from "@/lib/execution/binance-testnet-status";
import { buildProjectionBundle } from "./projection-bundle";
import type { ProjectionBundleResponse } from "./projection-bundle-shared";
import { normalizeBinanceStatusForUI } from "./normalize-projection-bundle";
import {
  getDefaultUiProjectionData,
  mapProjectionBundleToUi,
  uiProjectionHasRealTrades,
  type UiProjectionData,
} from "./ui-projection-data";
import { getDefaultBinanceStatus, type ProjectionSectionError } from "./projection-defaults";
import type { NormalizedProjectionBundle } from "./normalize-projection-bundle";
import { API_RESPONSE_BOUND_MS } from "./zero-state";

export type UiBundle = UiProjectionData;

function bundleHasTrades(bundle: ProjectionBundleResponse): boolean {
  const totalTrades = bundle.mission?.totalTrades ?? 0;
  const closedLen = bundle.trades?.closed?.length ?? 0;
  const openLen = bundle.trades?.open?.length ?? 0;
  return totalTrades > 0 || closedLen > 0 || openLen > 0;
}

/** REAL_BUNDLE when builder returned mission/trades — never zero-state defaults. */
export function resolveUiBundleSource(
  bundle: ProjectionBundleResponse,
  normalized: NormalizedProjectionBundle,
): UiProjectionData["source"] {
  if (bundle.ok || bundleHasTrades(bundle)) return "REAL_BUNDLE";
  return normalized.isFallback ? "FALLBACK" : "REAL_BUNDLE";
}

async function loadUiBundle(): Promise<UiBundle> {
  noStore();
  const errors: ProjectionSectionError[] = [];

  let bundle: ProjectionBundleResponse;
  try {
    bundle = await buildProjectionBundle();
  } catch (err) {
    errors.push({
      section: "bundle",
      code: "BUILD_FAILED",
      message: err instanceof Error ? err.message : "Projection bundle build failed",
    });
    return getDefaultUiProjectionData();
  }

  if (!bundle.ok && !bundleHasTrades(bundle)) {
    errors.push({
      section: "bundle",
      code: "BUILD_FAILED",
      message: bundle.error,
    });
    return getDefaultUiProjectionData();
  }

  if (!bundle.ok) {
    errors.push({
      section: "bundle",
      code: "BUILD_FAILED",
      message: bundle.error,
    });
    return getDefaultUiProjectionData();
  }

  let binanceStatus = getDefaultBinanceStatus();
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

  const ui = mapProjectionBundleToUi(bundle, { binanceStatus, errors });
  if (uiProjectionHasRealTrades(ui)) {
    return { ...ui, source: "REAL_BUNDLE", isFallback: false };
  }
  return ui;
}

/** Server-safe loader — same projection builder as GET /api/core/projections/bundle. */
export const getUiBundle = cache(loadUiBundle);
