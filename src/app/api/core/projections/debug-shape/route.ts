import { buildProjectionBundle } from "@/lib/core/projection-bundle";
import { projectionApiOk } from "@/lib/core/projection-api-response";
import { inspectProjectionBundleShape } from "@/lib/core/projection-bundle-shape";

export async function GET() {
  const bundle = await buildProjectionBundle();
  const envelope = {
    ok: bundle.ok,
    data: bundle.ok
      ? bundle
      : {
          mission: bundle.mission,
          trades: bundle.trades,
          positions: bundle.positions,
          pnl: bundle.pnl,
          evidence: bundle.evidence,
          risk: bundle.risk,
          health: bundle.health,
          meta: bundle.meta,
        },
    error: bundle.ok ? null : { message: bundle.error },
  };

  const shape = inspectProjectionBundleShape(envelope);

  return projectionApiOk(shape);
}
