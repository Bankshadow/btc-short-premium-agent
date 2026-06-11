import type { DefaultProjectionBundle } from "./projection-defaults";

export function bundleProjectionReady(
  bundle: Pick<DefaultProjectionBundle, "ok" | "mission" | "trades">,
): boolean {
  if (bundle.ok) return true;
  if (bundle.mission.totalTrades > 0) return true;
  if (bundle.trades.closed.length > 0) return true;
  if (bundle.trades.open.length > 0) return true;
  if ((bundle.trades.effectiveOpenCount ?? 0) > 0) return true;
  if ((bundle.trades.closedCount ?? 0) > 0) return true;
  return false;
}

export function pickClosedTradeCount(
  bundle: Pick<DefaultProjectionBundle, "trades" | "mission">,
): number {
  if (bundle.trades.closed.length > 0) return bundle.trades.closed.length;
  if (bundle.trades.closedCount != null) return bundle.trades.closedCount;
  return bundle.mission.closedTrades ?? bundle.mission.totalTrades ?? 0;
}

export function pickOpenTradeCount(
  bundle: Pick<DefaultProjectionBundle, "trades" | "mission">,
): number {
  if (bundle.trades.open.length > 0) return bundle.trades.open.length;
  if (bundle.trades.effectiveOpenCount != null) return bundle.trades.effectiveOpenCount;
  if (bundle.trades.openCount != null) return bundle.trades.openCount;
  return bundle.mission.openTrades ?? 0;
}

export function resolveCoreHealthStatus(
  apiHealth: { status?: string } | null | undefined,
  bundleHealth: { status?: string } | null | undefined,
): string {
  if (apiHealth?.status) return apiHealth.status;
  return bundleHealth?.status ?? "OK";
}
