/** MVP 83 — unified analysis context and persisted state. */
export const CENTRAL_ANALYSIS_ENGINE_MVP = 83 as const;
export const CENTRAL_ANALYSIS_ENGINE_LABEL = "Central Analysis Engine";

export type AnalysisEnvironment = "PAPER" | "TESTNET" | "LIVE_LOCKED";

export interface AnalysisContextMarket {
  spotPrice: number | null;
  regime: string | null;
  ivHvRatio: number | null;
  fundingRate: number | null;
}

export interface AnalysisContextCouncilState {
  weightedVerdict: string | null;
  confidence: number | null;
  riskVeto: boolean;
  agentCount: number;
}

export interface AnalysisContextSimulationState {
  available: boolean;
  lastRunAt: string | null;
}

export interface AnalysisContextIncidentState {
  openCount: number;
  criticalOpen: boolean;
  topTitle: string | null;
}

export interface AnalysisContextTestnetStatus {
  connected: boolean;
  configured: boolean;
  autoExecuteEnabled: boolean;
  liveLocked: true;
  blocker: string | null;
}

/** MVP 86 — advanced module link exposed on AnalysisContext. */
export interface AnalysisContextAdvancedModuleLink {
  id: string;
  label: string;
  engineReads: boolean;
  advisoryOnly: boolean;
  contextField: string | null;
  lastUpdatedAt: string | null;
  analysisImpact: string | null;
}

/** Unified input context assembled from existing desk modules. */
export interface AnalysisContext {
  runId: string;
  environment: AnalysisEnvironment;
  builtAt: string;
  market: AnalysisContextMarket;
  positions: string[];
  trades: { openCount: number; closedCount: number };
  decisionLog: import("@/lib/journal/decision-log-types").DecisionLogEntry[];
  journal: import("@/lib/testnet-monitor/types").TestnetMonitorJournalEvent[];
  strategyRegistry: import("@/lib/strategy-registry/strategy-registry-types").StrategyRegistryAnalyzePayload | null;
  governance: import("@/lib/governance/governance-types").GovernanceAnalyzePayload | null;
  validation: { killSwitchActive: boolean; blockers: string[] };
  killSwitch: { active: boolean; reason: string | null };
  riskPolicy: { profile: string; blockNewTrades: boolean; triggeredLimits: string[] };
  learningRecords: import("@/lib/testnet-monitor/types").TestnetLearningRecord[];
  agentScoreboard: { totalLearned: number; topAgent: string | null };
  councilState: AnalysisContextCouncilState;
  simulationState: AnalysisContextSimulationState;
  incidentState: AnalysisContextIncidentState;
  missionSnapshot: import("@/lib/mission-flow/types").MissionFlowSnapshot | null;
  testnetStatus: AnalysisContextTestnetStatus;
  advancedModules: AnalysisContextAdvancedModuleLink[];
  consistency: import("@/lib/engine-consistency/types").AnalysisContextConsistencyLink | null;
  evidenceQuality: import("@/lib/evidence-quality/types").AnalysisContextEvidenceQualityLink | null;
}

export interface CentralAnalysisState {
  mvp: typeof CENTRAL_ANALYSIS_ENGINE_MVP;
  label: typeof CENTRAL_ANALYSIS_ENGINE_LABEL;
  latestRunId: string | null;
  latestDecisionLogId: string | null;
  latestResultAt: string | null;
  context: AnalysisContext | null;
  liveTradingLocked: true;
  lastUpdatedAt: string;
}
