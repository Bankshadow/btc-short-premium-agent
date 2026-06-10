import { buildEnrichedAgentScoreboardV2 } from "./build-agent-scoreboard-v2-enriched";
import type {
  IntegratedStrategyAgentHealthBuildInput,
  IntegratedStrategyAgentHealthSnapshot,
} from "./types";
import {
  INTEGRATED_STRATEGY_AGENT_HEALTH_LABEL,
  INTEGRATED_STRATEGY_AGENT_HEALTH_MVP,
} from "./types";

export function buildIntegratedStrategyAgentHealth(
  input: IntegratedStrategyAgentHealthBuildInput,
): IntegratedStrategyAgentHealthSnapshot {
  const agentScoreboardV2 = buildEnrichedAgentScoreboardV2({
    journal: input.journal,
    closedTrades: input.closedTrades,
    learningRecords: input.learningRecords,
    decisions: input.decisions,
    tradeQualityScores: input.tradeQualityScores,
    calibrationReport: input.confidenceCalibrationReport,
  });

  return {
    mvp: INTEGRATED_STRATEGY_AGENT_HEALTH_MVP,
    label: INTEGRATED_STRATEGY_AGENT_HEALTH_LABEL,
    strategyHealth: input.strategyHealth,
    agentScoreboardV2,
    humanApprovalRequired: true,
    autoStrategyChangeAllowed: false,
    cannotIncreaseLiveRisk: true,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function emptyIntegratedStrategyAgentHealth(): IntegratedStrategyAgentHealthSnapshot {
  const now = new Date().toISOString();
  return {
    mvp: INTEGRATED_STRATEGY_AGENT_HEALTH_MVP,
    label: INTEGRATED_STRATEGY_AGENT_HEALTH_LABEL,
    strategyHealth: {
      mvp: 74,
      label: "Integrated Strategy Health After 12 Trades",
      evidenceRequired: 12,
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
      lastUpdatedAt: now,
    },
    agentScoreboardV2: {
      environment: "TESTNET",
      totalSamples: 0,
      rows: [],
      globalCalibrationGap: 0,
      topContributingAgent: null,
      weakestAgent: null,
      updatedAt: now,
    },
    humanApprovalRequired: true,
    autoStrategyChangeAllowed: false,
    cannotIncreaseLiveRisk: true,
    lastUpdatedAt: now,
  };
}
