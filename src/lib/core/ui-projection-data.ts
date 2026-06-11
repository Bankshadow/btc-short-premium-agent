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
import type { ProjectionBundleResponse } from "./projection-bundle-shared";
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

export function uiProjectionHasRealTrades(ui: UiProjectionData): boolean {
  return (
    ui.source === "REAL_BUNDLE" ||
    ui.mission.totalTrades > 0 ||
    ui.trades.closed.length > 0 ||
    ui.trades.open.length > 0
  );
}

/** Prefer server getUiBundle() over stale client context fallback. */
export function coalesceUiProjection(
  serverUi: UiProjectionData,
  ctx: UiProjectionData & { loading?: boolean; refreshing?: boolean; reload?: () => Promise<void> },
): UiProjectionData & {
  loading: boolean;
  refreshing: boolean;
  reload: () => Promise<void>;
} {
  const reload = ctx.reload ?? (async () => {});
  const refreshing = ctx.refreshing ?? false;

  if (serverUi.source === "REAL_BUNDLE") {
    return {
      ...serverUi,
      loading: false,
      refreshing,
      reload,
    };
  }

  const ctxReady = uiProjectionHasRealTrades(ctx);
  if (ctxReady) {
    return {
      ...ctx,
      loading: ctx.loading ?? false,
      refreshing,
      reload,
    };
  }
  if (uiProjectionHasRealTrades(serverUi)) {
    return {
      ...serverUi,
      loading: false,
      refreshing,
      reload,
    };
  }
  return {
    ...ctx,
    loading: ctx.loading ?? false,
    refreshing,
    reload,
  };
}

/** Map buildProjectionBundle() output directly — same fields as GET /api/core/projections/bundle data. */
export function mapProjectionBundleToUi(
  bundle: Extract<ProjectionBundleResponse, { ok: true }>,
  options?: {
    binanceStatus?: DefaultBinanceStatus;
    errors?: ProjectionSectionError[];
    warnings?: string[];
  },
): UiProjectionData {
  const mission = bundle.mission;
  const trades = bundle.trades;
  const closed = trades.closed ?? [];
  const open = trades.open ?? [];
  const openCount = trades.effectiveOpenCount ?? open.length;
  const closedCount = closed.length;
  const totalTrades = mission.totalTrades ?? (closedCount > 0 ? closedCount : openCount);

  const binanceNormalized = normalizeBinanceStatusForDisplay(
    (options?.binanceStatus ?? getDefaultBinanceStatus()) as BinanceStatusDiagnostics,
  );

  return {
    source: "REAL_BUNDLE",
    isFallback: false,
    mission: {
      currentEquity: mission.currentEquity,
      targetEquity: mission.targetCapital,
      progressPct: mission.progressPct,
      totalTrades,
      openTrades: openCount,
      closedTrades: closedCount > 0 ? closedCount : (mission.totalTrades ?? 0),
      netPnl: bundle.pnl?.totalNetPnl ?? mission.netPnl ?? 0,
      latestRunId: mission.latestRunId ?? null,
      latestDecisionLogId: mission.latestDecisionLogId ?? null,
      latestVerdict: mission.latestVerdict ?? null,
      startCapital: mission.startCapital,
      targetCapital: mission.targetCapital,
    },
    trades: {
      open: open as UiProjectionTrades["open"],
      closed: closed as UiProjectionTrades["closed"],
      effectiveOpenCount: openCount,
      staleOpenWarnings: trades.staleOpenWarnings ?? [],
    },
    evidence: {
      valid: bundle.evidence.valid,
      required: bundle.evidence.required,
      rejected: bundle.evidence.rejected ?? 0,
      readinessStatus: bundle.evidence.readinessStatus ?? "COLLECTING",
      message: bundle.evidence.message ?? null,
      trades: bundle.evidence.trades,
    },
    health: {
      status: bundle.health.status,
      warnings: bundle.health.warnings ?? [],
      blockingIssues: bundle.health.blockingIssues ?? [],
      rawWarningCount: bundle.health.rawWarningCount ?? 0,
      exchangeStatus: bundle.health.exchangeStatus ?? "DISCONNECTED",
      liveLocked: bundle.health.liveLocked ?? bundle.risk.liveLocked ?? true,
    },
    binanceStatus: {
      ...getDefaultBinanceStatus(),
      ...(options?.binanceStatus ?? getDefaultBinanceStatus()),
      ...binanceNormalized,
      zeroState: false,
    },
    risk: bundle.risk ?? getDefaultRiskProjectionView(),
    meta: bundle.meta ?? {},
    warnings: options?.warnings ?? [],
    errors: options?.errors ?? [],
    loadedAt: bundle.meta?.builtAt ?? new Date().toISOString(),
  };
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
    let source: UiProjectionData["source"] = result.normalized.isFallback
      ? "FALLBACK"
      : "REAL_BUNDLE";

    const ui = mapNormalizedToUiProjectionData(result.normalized, {
      source,
      warnings: result.warnings,
      errors: result.errors,
      loadedAt: result.bundle.loadedAt,
    });

    if (uiProjectionHasRealTrades(ui)) {
      return { ...ui, source: "REAL_BUNDLE", isFallback: false };
    }
    return ui;
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
