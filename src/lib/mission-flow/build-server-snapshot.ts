import {
  buildGoalDashboardServerPayload,
  buildGoalTradeListServer,
} from "@/lib/goal-engine/build-server-context";
import { loadServerAnalysisJournal } from "@/lib/journal/journal-server-store";
import { filterProductionEntries } from "@/lib/journal/production-filter";
import { buildMissionFlowSnapshot } from "./build-mission-flow-snapshot";
import { emptyMissionFlowSnapshot } from "./empty-snapshot";
import type { MissionFlowSnapshot } from "./types";

export async function buildMissionFlowServerSnapshot(): Promise<MissionFlowSnapshot> {
  try {
    const [payload, trades, entriesRaw] = await Promise.all([
      buildGoalDashboardServerPayload(),
      buildGoalTradeListServer().catch(() => []),
      loadServerAnalysisJournal().catch(() => []),
    ]);

    const entries = filterProductionEntries(entriesRaw);
    const latestDecisionLogId = entries[0]?.id ?? null;
    const openTrades = trades.filter(
      (t) => t.result === "OPEN" && t.environment !== "LIVE",
    ).length;

    return buildMissionFlowSnapshot(payload, latestDecisionLogId, openTrades);
  } catch {
    return emptyMissionFlowSnapshot();
  }
}
