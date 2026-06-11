import { normalizeBinanceStatusForDisplay } from "@/lib/binance/normalize-binance-status";
import type { BinanceStatusDiagnostics } from "@/lib/execution/binance-status-diagnostics";
import type { CoreHealthReport } from "./core-health";
import type { EvidenceProgress } from "@/lib/evidence/evidence-types";
import {
  getDefaultBinanceStatus,
  getDefaultCoreHealth,
  getDefaultEvidenceProjection,
  getDefaultMissionProjection,
  getDefaultPnlProjection,
  getDefaultProjectionBundle,
  getDefaultRiskProjectionView,
  getDefaultTradeProjection,
  PROJECTION_FALLBACK_ACTIVE_MESSAGE,
  PROJECTION_UNAVAILABLE_MESSAGE,
  type DefaultBinanceStatus,
  type ProjectionSectionError,
} from "./projection-defaults";
import {
  normalizeProjectionBundle,
  type NormalizedProjectionBundle,
} from "./normalize-projection-bundle";
import { getProjectionBundleForUI } from "./projection-client";
import type { RiskProjectionView } from "./projection-bundle-shared";
import type { StaleOpenTradeWarning } from "./trade-reconciliation";

export interface UiProjectionMission {
  currentEquity: number;
  targetEquity: number;
  progressPct: number;
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  netPnl: number;
  latestRunId: string | null;
  latestDecisionLogId: string | null;
  latestVerdict: string | null;
  startCapital: number;
  targetCapital: number;
}

export interface UiProjectionTrades {
  open: NormalizedProjectionBundle["trades"]["open"];
  closed: NormalizedProjectionBundle["trades"]["closed"];
  effectiveOpenCount: number;
  staleOpenWarnings: StaleOpenTradeWarning[];
}

export interface UiProjectionEvidence {
  valid: number;
  required: number;
  rejected: number;
  readinessStatus: string;
  message: string | null;
  trades?: EvidenceProgress["trades"];
}

export interface UiProjectionHealth {
  status: string;
  warnings: CoreHealthReport["warnings"];
  blockingIssues: CoreHealthReport["blockingIssues"];
  rawWarningCount: number;
  exchangeStatus: string;
  liveLocked: boolean;
}

export interface UiProjectionData {
  source: "REAL_BUNDLE" | "FALLBACK";
  isFallback: boolean;
  mission: UiProjectionMission;
  trades: UiProjectionTrades;
  evidence: UiProjectionEvidence;
  health: UiProjectionHealth;
  binanceStatus: DefaultBinanceStatus;
  risk: RiskProjectionView;
  meta: { eventCount?: number; builtAt?: string; cacheKey?: string };
  warnings: string[];
  errors: ProjectionSectionError[];
  loadedAt: string;
}

function fallbackUiProjectionData(
  errors: ProjectionSectionError[] = [],
  warnings: string[] = [],
): UiProjectionData {
  const bundle = getDefaultProjectionBundle();
  return mapNormalizedToUiProjectionData(normalizeProjectionBundle(null, { errors }), {
    source: "FALLBACK",
    warnings: [
      PROJECTION_FALLBACK_ACTIVE_MESSAGE,
      PROJECTION_UNAVAILABLE_MESSAGE,
      ...warnings,
    ],
    errors,
    loadedAt: bundle.loadedAt,
  });
}

/** Aggregate evidence rejection codes for UI display (client-safe). */
export function aggregateEvidenceRejectionReasons(
  evidence: UiProjectionEvidence,
): string[] {
  const counts = new Map<string, number>();
  for (const trade of evidence.trades ?? []) {
    if (trade.status !== "REJECTED") continue;
    for (const reason of trade.rejectionReasons) {
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => (count > 1 ? `${reason} (×${count})` : reason));
}

export function mapNormalizedToUiProjectionData(
  normalized: NormalizedProjectionBundle,
  options: {
    source: "REAL_BUNDLE" | "FALLBACK";
    warnings?: string[];
    errors?: ProjectionSectionError[];
    loadedAt?: string;
  },
): UiProjectionData {
  const closedCount =
    normalized.trades.closed.length > 0
      ? normalized.trades.closed.length
      : (normalized.trades.closedCount ?? normalized.mission.closedTrades ?? 0);
  const openCount =
    normalized.trades.effectiveOpenCount ??
    normalized.trades.openCount ??
    normalized.trades.open.length;

  const binanceNormalized = normalizeBinanceStatusForDisplay(
    normalized.binanceStatus as BinanceStatusDiagnostics,
  );

  return {
    source: options.source,
    isFallback: options.source === "FALLBACK",
    mission: {
      currentEquity: normalized.mission.currentEquity,
      targetEquity: normalized.mission.targetEquity ?? normalized.mission.targetCapital,
      progressPct: normalized.mission.progressPct,
      totalTrades: normalized.mission.totalTrades,
      openTrades: openCount,
      closedTrades: closedCount,
      netPnl: normalized.pnl.totalNetPnl ?? normalized.mission.netPnl,
      latestRunId: normalized.mission.latestRunId,
      latestDecisionLogId: normalized.mission.latestDecisionLogId,
      latestVerdict: normalized.mission.latestVerdict,
      startCapital: normalized.mission.startCapital,
      targetCapital: normalized.mission.targetCapital,
    },
    trades: {
      open: normalized.trades.open,
      closed: normalized.trades.closed,
      effectiveOpenCount: openCount,
      staleOpenWarnings: normalized.trades.staleOpenWarnings ?? [],
    },
    evidence: {
      valid: normalized.evidence.valid,
      required: normalized.evidence.required,
      rejected: normalized.evidence.rejected ?? 0,
      readinessStatus: normalized.evidence.readinessStatus ?? "COLLECTING",
      message: normalized.evidence.message ?? null,
      trades: normalized.evidence.trades,
    },
    health: {
      status: normalized.health?.status ?? getDefaultCoreHealth().status,
      warnings: normalized.health?.warnings ?? [],
      blockingIssues: normalized.health?.blockingIssues ?? [],
      rawWarningCount: normalized.health?.rawWarningCount ?? 0,
      exchangeStatus: normalized.health?.exchangeStatus ?? "DISCONNECTED",
      liveLocked: normalized.health?.liveLocked ?? normalized.risk.liveLocked ?? true,
    },
    binanceStatus: {
      ...getDefaultBinanceStatus(),
      ...normalized.binanceStatus,
      ...binanceNormalized,
      zeroState: options.source === "FALLBACK",
    },
    risk: normalized.risk ?? getDefaultRiskProjectionView(),
    meta: normalized.meta ?? {},
    warnings: options.warnings ?? normalized.warnings,
    errors: options.errors ?? normalized.errors,
    loadedAt: options.loadedAt ?? new Date().toISOString(),
  };
}

export async function getUiProjectionData(
  options?: { timeoutMs?: number; includeBinance?: boolean },
): Promise<UiProjectionData> {
  try {
    const result = await getProjectionBundleForUI(options);
    const source: UiProjectionData["source"] = result.normalized.isFallback
      ? "FALLBACK"
      : "REAL_BUNDLE";

    return mapNormalizedToUiProjectionData(result.normalized, {
      source,
      warnings: result.warnings,
      errors: result.errors,
      loadedAt: result.bundle.loadedAt,
    });
  } catch (err) {
    const errors: ProjectionSectionError[] = [
      {
        section: "ui-projection",
        code: "FETCH_FAILED",
        message: err instanceof Error ? err.message : "UI projection load failed",
      },
    ];
    return fallbackUiProjectionData(errors);
  }
}

/** Zero-state UI projection for SSR / initial render. */
export function getDefaultUiProjectionData(): UiProjectionData {
  return mapNormalizedToUiProjectionData(
    {
      mission: getDefaultMissionProjection(),
      trades: getDefaultTradeProjection(),
      positions: getDefaultProjectionBundle().positions,
      pnl: getDefaultPnlProjection(),
      evidence: getDefaultEvidenceProjection(),
      risk: getDefaultRiskProjectionView(),
      health: getDefaultCoreHealth(),
      binanceStatus: getDefaultBinanceStatus(),
      meta: {},
      isFallback: true,
      warnings: [],
      errors: [],
    },
    { source: "FALLBACK", loadedAt: new Date().toISOString() },
  );
}
