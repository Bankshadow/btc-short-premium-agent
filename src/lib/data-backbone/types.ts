import type { CommandCenterStatus } from "@/lib/command-center/types";
import type { OperatorAction } from "@/lib/operator-action-queue/types";
import type { AgentRecommendation } from "@/lib/agents/types";
import type { OutcomeStatus } from "@/lib/journal/decision-log-types";

export const BACKBONE_VERSION = 1;

export type DataSourceKind = "localStorage" | "supabase" | "memory" | "hybrid";

export type SyncStatus = "OK" | "PENDING" | "FAILED" | "OFF";

export type TradeBookLabel =
  | "PAPER_STRICT"
  | "PAPER_SHADOW"
  | "DEMO"
  | "TESTNET"
  | "LIVE";

export type DeskRunStatus =
  | "IDLE"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "BLOCKED";

export interface DeskRun {
  runId: string;
  startedAt: string;
  completedAt: string | null;
  status: DeskRunStatus;
  mode: string;
  deskStatus: CommandCenterStatus;
  finalVerdict: AgentRecommendation | "NONE";
  confidence: number;
  briefing: string;
  source: DataSourceKind;
  writeOk: boolean;
  errors: string[];
}

export interface DeskDecision {
  decisionId: string;
  runId: string | null;
  timestamp: string;
  btcPrice: number;
  finalVerdict: AgentRecommendation;
  outcomeStatus: OutcomeStatus;
  paperPnl: number | null;
  marketRegime: string;
  riskVeto: boolean;
  bookLabel: TradeBookLabel;
  isDemoData: boolean;
  linkedTradeIds: string[];
}

export interface DeskTrade {
  tradeId: string;
  decisionId: string;
  book: TradeBookLabel;
  instrument: string;
  status: "OPEN" | "CLOSED" | "CANCELLED";
  openedAt: string;
  closedAt: string | null;
  realizedPnlPct: number | null;
  notionalUsd: number;
  isDemoData: boolean;
}

export interface DeskPortfolioSnapshot {
  generatedAt: string;
  paperPnlPct: number;
  openPaperTrades: number;
  closedPaperTrades: number;
  shadowTrades: number;
  exposureUsd: number;
  drawdownPct: number;
  resolvedLogCount: number;
  productionResolvedCount: number;
  winRatePct: number;
  sampleSize: number;
}

export interface DeskLearningSnapshot {
  generatedAt: string;
  decisionLogsCount: number;
  resolvedOutcomesCount: number;
  paperTradesCount: number;
  shadowTradesCount: number;
  strategySampleSize: number;
  minRequiredSampleSize: number;
  agentScoreboardReady: boolean;
  validationReady: boolean;
  capitalScalingReady: boolean;
  label: string;
  detail: string;
}

export interface DeskRiskSnapshot {
  generatedAt: string;
  deskStatus: CommandCenterStatus;
  blockers: string[];
  liveReadinessBlocked: boolean;
  backboneHealthy: boolean;
}

export type DeskActionItem = OperatorAction;

export interface DeskModuleState {
  moduleId: string;
  status: "OK" | "SKIPPED" | "ERROR" | "BLOCKED" | "IDLE";
  summary: string;
  lastRunAt: string | null;
  shouldDisplayToUser: boolean;
}

export interface DeskBackboneHealth {
  healthy: boolean;
  lastWriteAt: string | null;
  syncStatus: SyncStatus;
  source: DataSourceKind;
  missingFields: string[];
  staleWarning: string | null;
  writeBlockers: string[];
  liveModeAllowed: boolean;
}

export interface DeskBackboneRecord {
  version: number;
  clientId: string;
  lastWriteAt: string;
  lastRunId: string | null;
  run: DeskRun | null;
  decisions: DeskDecision[];
  trades: DeskTrade[];
  portfolio: DeskPortfolioSnapshot;
  learning: DeskLearningSnapshot;
  risk: DeskRiskSnapshot;
  actions: DeskActionItem[];
  modules: DeskModuleState[];
  health: DeskBackboneHealth;
}

export type WriteDeskCycleInput = {
  run?: Partial<DeskRun> | null;
  autopilotResult?: import("@/lib/autopilot/types").AutopilotRunResult | null;
  writeError?: string | null;
  syncStatus?: SyncStatus;
  source?: DataSourceKind;
};
