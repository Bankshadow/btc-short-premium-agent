import type { DefaultProjectionBundle } from "./projection-defaults";
import { bundleProjectionReady } from "./ui-projection-bind";

export interface DashboardProjectionMetrics {
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
  evidenceValid: number;
  evidenceRequired: number;
  coreHealthStatus: string;
  liveLocked: boolean;
  usingFallback: boolean;
}

export function mapBundleToDashboardMetrics(
  bundle: Pick<
    DefaultProjectionBundle,
    "ok" | "mission" | "trades" | "pnl" | "evidence" | "risk" | "health"
  >,
): DashboardProjectionMetrics {
  const usingFallback = !bundleProjectionReady(bundle);

  const openTrades =
    bundle.trades.effectiveOpenCount ??
    (bundle.trades.open.length > 0 ? bundle.trades.open.length : null) ??
    bundle.trades.openCount ??
    0;
  const closedTrades =
    bundle.trades.closed.length > 0
      ? bundle.trades.closed.length
      : (bundle.trades.closedCount ?? 0);

  return {
    currentEquity: bundle.mission.currentEquity,
    targetEquity: bundle.mission.targetEquity ?? bundle.mission.targetCapital,
    progressPct: bundle.mission.progressPct,
    totalTrades: bundle.mission.totalTrades,
    openTrades,
    closedTrades,
    netPnl: bundle.pnl.totalNetPnl ?? bundle.mission.netPnl,
    latestRunId: bundle.mission.latestRunId,
    latestDecisionLogId: bundle.mission.latestDecisionLogId,
    latestVerdict: bundle.mission.latestVerdict,
    evidenceValid: bundle.evidence.valid,
    evidenceRequired: bundle.evidence.required,
    coreHealthStatus: bundle.health?.status ?? "OK",
    liveLocked: bundle.risk.liveLocked ?? bundle.health?.liveLocked ?? true,
    usingFallback,
  };
}
