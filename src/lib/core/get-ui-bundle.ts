import { getBinanceTestnetStatusBounded } from "@/lib/execution/binance-testnet-status";
import { buildProjectionBundle } from "./projection-bundle";
import { normalizeBinanceStatusForUI, normalizeProjectionBundle } from "./normalize-projection-bundle";
import {
  getDefaultUiProjectionData,
  mapNormalizedToUiProjectionData,
  type UiProjectionData,
} from "./ui-projection-data";
import type { ProjectionSectionError } from "./projection-defaults";
import { API_RESPONSE_BOUND_MS } from "./zero-state";

export type UiBundle = UiProjectionData;

/** Server-safe loader — same projection builder as GET /api/core/projections/bundle. */
export async function getUiBundle(): Promise<UiBundle> {
  const errors: ProjectionSectionError[] = [];

  try {
    const bundle = await buildProjectionBundle();

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

    const normalized = normalizeProjectionBundle(bundle, { binanceStatus, errors });
    const source: UiBundle["source"] = normalized.isFallback ? "FALLBACK" : "REAL_BUNDLE";

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
