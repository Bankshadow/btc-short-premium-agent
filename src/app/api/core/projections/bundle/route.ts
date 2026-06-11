import { buildProjectionBundle } from "@/lib/core/projection-bundle";
import { getDefaultProjectionBundle } from "@/lib/core/projection-defaults";
import { projectionApiFail, projectionApiOk } from "@/lib/core/projection-api-response";

export async function GET() {
  try {
    const bundle = await buildProjectionBundle();
    if (bundle.ok) {
      return projectionApiOk(bundle);
    }
    return projectionApiFail(
      {
        mission: bundle.mission,
        trades: bundle.trades,
        positions: bundle.positions,
        pnl: bundle.pnl,
        evidence: bundle.evidence,
        risk: bundle.risk,
        health: bundle.health,
        meta: bundle.meta,
      },
      bundle.error,
    );
  } catch (err) {
    const zero = getDefaultProjectionBundle();
    return projectionApiFail(
      {
        mission: zero.mission,
        trades: zero.trades,
        positions: zero.positions,
        pnl: zero.pnl,
        evidence: zero.evidence,
        risk: zero.risk,
        health: zero.health,
      },
      err instanceof Error ? err.message : "Projection bundle failed",
    );
  }
}
