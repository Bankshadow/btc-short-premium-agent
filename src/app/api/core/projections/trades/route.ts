import { buildEnrichedTradeProjection } from "@/lib/core/build-enriched-trade-projection";
import { readCoreEvents } from "@/lib/core/event-store";
import { getDefaultTradeProjection } from "@/lib/core/projection-defaults";
import { runProjectionRoute } from "@/lib/core/projection-route";

export async function GET() {
  return runProjectionRoute("trades", getDefaultTradeProjection(), async () => {
    const events = await readCoreEvents();
    const projection = await buildEnrichedTradeProjection(events);
    return {
      ...projection,
      trades: projection.open,
      openTrades: projection.open,
      closedTrades: projection.closed,
      totalTrades: projection.summary.openCount + projection.summary.closedCount,
      openCount: projection.summary.openCount,
      closedCount: projection.summary.closedCount,
      sprint: "slice-7",
    };
  });
}
