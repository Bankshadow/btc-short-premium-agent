import type { IntegratedStrategyHealthSnapshot } from "./types";
import {
  INTEGRATED_STRATEGY_HEALTH_LABEL,
  INTEGRATED_STRATEGY_HEALTH_MVP,
  STRATEGY_HEALTH_EVIDENCE_REQUIRED,
} from "./types";

export function emptyIntegratedStrategyHealth(): IntegratedStrategyHealthSnapshot {
  return {
    mvp: INTEGRATED_STRATEGY_HEALTH_MVP,
    label: INTEGRATED_STRATEGY_HEALTH_LABEL,
    evidenceRequired: STRATEGY_HEALTH_EVIDENCE_REQUIRED,
    evidenceReady: false,
    primaryReport: null,
    reportsByTag: [],
    registryRecommendation: null,
    agentScoreboardLearned: 0,
    governanceWarningActive: false,
    blocksNewTestnetEntries: false,
    autoStrategyChangeAllowed: false,
    liveTradingBlocked: true,
    confidenceOverconfidenceDetected: false,
    confidenceAdjustmentRecommendation: null,
    evidenceQualityBlocked: false,
    evidenceQualityBlockReason: null,
    lastUpdatedAt: new Date().toISOString(),
  };
}
