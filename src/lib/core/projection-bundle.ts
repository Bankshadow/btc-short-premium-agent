import { evaluateCoreHealth } from "./core-health";
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
