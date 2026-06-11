import { readCoreEvents } from "@/lib/core/event-store";
import { buildProjectionById } from "@/lib/core/projection-engine";
import type { PnlProjection } from "@/lib/core/projections/pnl-projection";
import { getDefaultPnlProjection } from "@/lib/core/projection-defaults";
import { runProjectionRoute } from "@/lib/core/projection-route";

export async function GET() {
  return runProjectionRoute("pnl", getDefaultPnlProjection(), async () => {
    const events = await readCoreEvents();
    const pnl = buildProjectionById("pnl", events) as PnlProjection;
    return {
      ...pnl,
      realizedPnl: pnl.totalNetPnl,
      unrealizedPnl: 0,
      netPnl: pnl.totalNetPnl,
      latestResult: null,
    };
  });
}
