import { fetchJson } from "@/lib/api/fetch-json";
import type { BinanceStatusDiagnostics } from "@/lib/execution/binance-status-diagnostics";
import type { CoreHealthReport } from "./core-health";
import type { EvidenceProgress } from "@/lib/evidence/evidence-types";
import type { MissionSnapshot } from "@/lib/mission/mission-types";
import type { EnrichedTradeProjection } from "./build-enriched-trade-projection";
import { buildProjectionBundle } from "./projection-bundle";
import {
  type ProjectionBundleResponse,
  type RiskProjectionView,
  zeroProjectionBundle,
} from "./projection-bundle-shared";
import type { PnlProjection } from "./projections/pnl-projection";
import type { PositionProjection } from "./projections/position-projection";
import type { TradeProjection } from "./projections/trade-projection";

const DEFAULT_TIMEOUT_MS = 5_000;

export type { ProjectionBundleResponse };

export async function getMissionProjection(
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<MissionSnapshot> {
  try {
    return await fetchJson<MissionSnapshot>("/api/core/projections/mission", { timeoutMs });
  } catch {
    return zeroProjectionBundle().mission;
  }
}

export async function getTradeProjection(
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<EnrichedTradeProjection> {
  try {
    return await fetchJson<EnrichedTradeProjection>("/api/core/projections/trades", { timeoutMs });
  } catch {
    const z = zeroProjectionBundle();
    return {
      open: [],
      closed: z.trades.closed,
      summary: {
        openCount: 0,
        closedCount: 0,
        realizedPnl: 0,
        executionCount: 0,
      },
    };
  }
}

export async function getPositionProjection(
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<PositionProjection> {
  try {
    return await fetchJson<PositionProjection>("/api/core/projections/positions", { timeoutMs });
  } catch {
    return zeroProjectionBundle().positions;
  }
}

export async function getPnlProjection(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<PnlProjection> {
  try {
    return await fetchJson<PnlProjection>("/api/core/projections/pnl", { timeoutMs });
  } catch {
    return zeroProjectionBundle().pnl;
  }
}

export async function getEvidenceProjection(
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<EvidenceProgress> {
  try {
    return await fetchJson<EvidenceProgress>("/api/core/projections/evidence", { timeoutMs });
  } catch {
    return zeroProjectionBundle().evidence;
  }
}

export async function getRiskProjection(
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<RiskProjectionView> {
  try {
    return await fetchJson<RiskProjectionView>("/api/core/projections/risk", { timeoutMs });
  } catch {
    return zeroProjectionBundle().risk;
  }
}

export async function getCoreHealth(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<CoreHealthReport | null> {
  try {
    return await fetchJson<CoreHealthReport>("/api/core/health", { timeoutMs });
  } catch {
    return null;
  }
}

export type ProjectionBundleWithBinance = ProjectionBundleResponse & {
  binanceStatus?: BinanceStatusDiagnostics | null;
};

export async function getProjectionBundle(
  options?: { timeoutMs?: number; includeBinance?: boolean },
): Promise<ProjectionBundleWithBinance> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  try {
    const bundle = await fetchJson<ProjectionBundleResponse>("/api/core/projections/bundle", {
      timeoutMs,
    });
    if (!options?.includeBinance) return bundle;
    const binanceStatus = await fetchJson<BinanceStatusDiagnostics>("/api/binance/status", {
      timeoutMs,
    }).catch(() => null);
    return { ...bundle, binanceStatus };
  } catch (err) {
    return {
      ...zeroProjectionBundle(),
      ok: false,
      error: err instanceof Error ? err.message : "Bundle fetch failed",
      health: null,
      meta: { eventCount: 0, builtAt: new Date().toISOString(), cacheKey: "error" },
    };
  }
}

/** Server-side bundle builder (API routes, consistency checks). */
export { buildProjectionBundle, zeroProjectionBundle };
