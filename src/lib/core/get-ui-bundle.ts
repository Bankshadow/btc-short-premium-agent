import { unstable_noStore as noStore } from "next/cache";
import { getBinanceTestnetStatusBounded } from "@/lib/execution/binance-testnet-status";
import { buildProjectionBundle } from "./projection-bundle";
import type { ProjectionBundleResponse } from "./projection-bundle-shared";
import { normalizeBinanceStatusForUI } from "./normalize-projection-bundle";
import {
  getDefaultUiProjectionData,
  mapProjectionBundleToUi,
  uiBundleHasRealData,
  type UiProjectionData,
} from "./ui-projection-data";
import { getDefaultBinanceStatus, type ProjectionSectionError } from "./projection-defaults";
import { API_RESPONSE_BOUND_MS } from "./zero-state";

export type UiBundle = UiProjectionData;

/** Same builder entry point as GET /api/core/projections/bundle — no HTTP fetch. */
export async function loadServerProjectionBundle(): Promise<ProjectionBundleResponse> {
  noStore();
  return buildProjectionBundle();
}

/** Server-safe loader — direct builder, same as /api/core/projections/bundle. */
export async function getUiBundle(): Promise<UiBundle> {
  noStore();
  const errors: ProjectionSectionError[] = [];

  let bundle: ProjectionBundleResponse;
  try {
    bundle = await loadServerProjectionBundle();
  } catch (err) {
    errors.push({
      section: "bundle",
      code: "BUILD_FAILED",
      message: err instanceof Error ? err.message : "Projection bundle build failed",
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
  if (uiBundleHasRealData(ui)) {
    return { ...ui, source: "REAL_BUNDLE", isFallback: false };
  }
  return ui;
}
