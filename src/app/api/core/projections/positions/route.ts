import { readCoreEvents } from "@/lib/core/event-store";
import { buildProjectionById } from "@/lib/core/projection-engine";
import type { PositionProjection } from "@/lib/core/projections/position-projection";
import { getDefaultPositionProjection } from "@/lib/core/projection-defaults";
import { runProjectionRoute } from "@/lib/core/projection-route";

export async function GET() {
  return runProjectionRoute("positions", getDefaultPositionProjection(), async () => {
    const events = await readCoreEvents();
    const positions = buildProjectionById("positions", events) as PositionProjection;
    return {
      ...positions,
      positions: positions.snapshots,
      openPositionCount: positions.openTradeCount,
      reconciliationStatus: "OK" as const,
      message: positions.openTradeCount > 0 ? "Open positions monitored." : "No open positions",
    };
  });
}
