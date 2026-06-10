import { filterProductionEntries } from "@/lib/journal/production-filter";
import { loadCentralAnalysisBundle } from "@/lib/analysis-engine/analysis-orchestrator";
import { readMissionSnapshotCache } from "@/lib/mission-flow/snapshot-cache";
import type { BinancePosition, BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { TestnetClosedTrade, TestnetLearningRecord } from "@/lib/testnet-monitor/types";
import type { TestnetMonitorJournalEvent } from "@/lib/testnet-monitor/types";
import { assembleEngineConsistencySnapshot } from "./assemble-engine-consistency-snapshot";
import type { EngineConsistencySnapshot } from "./types";

export interface BuildEngineConsistencyFromTestnetInput {
  connected: boolean;
  positions: BinancePosition[];
  journal: BinanceTestnetJournalEntry[];
  positionMismatches: string[];
  closedTrades: TestnetClosedTrade[];
  learningRecords: TestnetLearningRecord[];
  monitorEvents: TestnetMonitorJournalEvent[];
  decisions: DecisionLogEntry[];
  dashboardNetPnl: number;
}

/** Lightweight MVP 88 builder for testnet monitor pipeline — avoids mission-flow circular deps. */
export async function buildEngineConsistencyFromTestnet(
  input: BuildEngineConsistencyFromTestnetInput,
): Promise<EngineConsistencySnapshot> {
  const decisions = filterProductionEntries(input.decisions);
  const centralBundle = await loadCentralAnalysisBundle().catch(() => null);
  const cachedMission = readMissionSnapshotCache();

  return assembleEngineConsistencySnapshot({
    connected: input.connected,
    positions: input.positions,
    binanceJournal: input.journal,
    positionMismatches: input.positionMismatches,
    learningRecords: input.learningRecords,
    monitorEvents: input.monitorEvents,
    decisions,
    dashboardNetPnl: input.dashboardNetPnl,
    centralDecisionLogId: centralBundle?.state.latestDecisionLogId ?? null,
    missionDecisionLogId: cachedMission?.snapshot.latestDecisionLogId ?? null,
    missionNetPnl: cachedMission?.snapshot.netPnl ?? null,
  });
}
