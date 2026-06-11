import type { DefaultProjectionBundle } from "./projection-defaults";

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
  liveLocked: boolean;
  usingFallback: boolean;
}

export function mapBundleToDashboardMetrics(
  bundle: Pick<
    DefaultProjectionBundle,
    "ok" | "mission" | "trades" | "pnl" | "evidence" | "risk" | "health"
  >,
): DashboardProjectionMetrics {
  const missionZero = bundle.mission.zeroState === true;
  const tradesZero = bundle.trades.zeroState === true;
  const usingFallback = !bundle.ok || (missionZero && tradesZero);

  const openTrades =
    bundle.trades.effectiveOpenCount ??
    bundle.trades.openCount ??
    bundle.trades.open.length;
  const closedTrades =
    bundle.trades.closedCount ?? bundle.trades.closed.length;

  return {
    currentEquity: bundle.mission.currentEquity,
    targetEquity: bundle.mission.targetCapital,
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
    liveLocked: bundle.risk.liveLocked ?? bundle.health?.liveLocked ?? true,
    usingFallback,
  };
}
