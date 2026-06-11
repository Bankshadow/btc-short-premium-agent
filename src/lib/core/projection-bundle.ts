import { evaluateCoreHealth, type CoreHealthReport } from "./core-health";
import { readCoreEvents } from "./event-store";
import { buildAllProjections } from "./projection-engine";
import {
  projectionBundleError,
  type ProjectionBundleResponse,
} from "./projection-bundle-shared";

export type {
  ProjectionBundlePayload,
  ProjectionBundleError,
  ProjectionBundleResponse,
  ProjectionBundleMeta,
  RiskProjectionView,
} from "./projection-bundle-shared";

export { zeroProjectionBundle, projectionBundleError } from "./projection-bundle-shared";

function lightweightHealthFromProjections(
  all: ReturnType<typeof buildAllProjections>,
): CoreHealthReport {
  const lastCheckedAt = new Date().toISOString();
  const staleCount = all.trades.staleOpenWarnings?.length ?? 0;
  return {
    status: staleCount > 0 ? "WARNING" : "OK",
    eventJournalStatus: "OK",
    projectionStatus: "OK",
    lifecycleStatus: staleCount > 0 ? "WARNING" : "OK",
    riskStatus: all.risk.portfolioBlocksExecution ? "BLOCKED" : "SAFE",
    exchangeStatus: "UNKNOWN",
    operatorStatus: "ACTIVE",
    safetyStatus: "OK",
    blockingIssues: [],
    warnings: [],
    rawWarningCount: 0,
    lastCheckedAt,
    liveLocked: true,
  };
}

/** Fast bundle for ui-consistency / projection-parity (no Binance, no full health rebuild). */
export async function buildProjectionBundleFast(): Promise<ProjectionBundleResponse> {
  try {
    const events = await readCoreEvents();
    const all = buildAllProjections(events, { bustCache: false });
    return {
      ok: true,
      mission: all.mission,
      trades: all.trades,
      positions: all.positions,
      pnl: all.pnl,
      evidence: all.evidence,
      risk: { ...all.risk, liveLocked: true },
      health: lightweightHealthFromProjections(all),
      meta: all.meta,
    };
  } catch (err) {
    return projectionBundleError(err instanceof Error ? err.message : "Projection bundle failed");
  }
}

export async function buildProjectionBundle(): Promise<ProjectionBundleResponse> {
  try {
    const events = await readCoreEvents();
    const all = buildAllProjections(events, { bustCache: true });
    const health = await evaluateCoreHealth();
    return {
      ok: true,
      mission: all.mission,
      trades: all.trades,
      positions: all.positions,
      pnl: all.pnl,
      evidence: all.evidence,
      risk: { ...all.risk, liveLocked: true },
      health,
      meta: all.meta,
    };
  } catch (err) {
    return projectionBundleError(err instanceof Error ? err.message : "Projection bundle failed");
  }
}
