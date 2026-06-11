import { readCoreEvents } from "@/lib/core/event-store";
import { buildProjectionById } from "@/lib/core/projection-engine";
import { getDefaultMissionProjection } from "@/lib/core/projection-defaults";
import type { MissionSnapshot } from "@/lib/mission/mission-types";
import { runProjectionRoute } from "@/lib/core/projection-route";

export async function GET() {
  return runProjectionRoute("mission", getDefaultMissionProjection(), async () => {
    const events = await readCoreEvents();
    const mission = buildProjectionById("mission", events) as MissionSnapshot;
    return {
      ...mission,
      targetEquity: mission.targetCapital,
      openTrades: mission.openPositions,
      closedTrades: Math.max(0, mission.totalTrades - mission.openPositions),
      winCount: mission.win,
      lossCount: mission.loss,
      breakevenCount: mission.breakeven,
    };
  });
}
