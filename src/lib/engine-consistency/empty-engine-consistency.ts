import {
  ENGINE_CONSISTENCY_LABEL,
  ENGINE_CONSISTENCY_MVP,
  type EngineConsistencySnapshot,
} from "./types";

export function emptyEngineConsistencySnapshot(): EngineConsistencySnapshot {
  return {
    mvp: ENGINE_CONSISTENCY_MVP,
    label: ENGINE_CONSISTENCY_LABEL,
    consistencyStatus: "OK",
    consistencyLabel: "Consistent",
    positionStateUncertain: false,
    blocksNewTrades: false,
    issues: [],
    autoFixAvailable: false,
    autoFixActions: [],
    requiredManualActions: [],
    generatedAt: new Date().toISOString(),
    storeSummary: {
      decisionLogCount: 0,
      tradeJournalCount: 0,
      monitorEventCount: 0,
      learningRecordCount: 0,
      binanceOpenPositions: 0,
      localOpenTrades: 0,
      missionDecisionLogId: null,
      centralDecisionLogId: null,
      missionNetPnl: 0,
      dashboardNetPnl: 0,
    },
  };
}
