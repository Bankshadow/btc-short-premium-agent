import type { CommandCenterReport } from "@/lib/command-center/types";
import type { DeskIncident, GovernanceDeskState } from "@/lib/governance/governance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import type { LiveReadinessReport } from "@/lib/live-readiness/types";
import type { RealTimeRiskReport } from "@/lib/real-time-risk/types";
import type { ExchangeStatusResult } from "@/lib/exchange/types";

export const LIVE_SCALE_UP_SAFETY_NOTICE =
  "Live scale-up defaults to disabled. Promotion requires human approval. The system may auto-demote but never auto-promote. BTC options live is excluded.";

export type LiveScaleStage =
  | "LIVE_STAGE_0_DISABLED"
  | "LIVE_STAGE_1_SMOKE_TEST"
  | "LIVE_STAGE_2_MICRO_SIZE"
  | "LIVE_STAGE_3_SMALL_SIZE"
  | "LIVE_STAGE_4_CONTROLLED_PRODUCTION";

export interface ScaleStageDefinition {
  stage: LiveScaleStage;
  label: string;
  description: string;
  maxNotionalPerTrade: number;
  maxDailyTrades: number;
  maxDailyLoss: number;
  maxWeeklyLoss: number;
  allowedSymbols: string[];
  allowedStrategies: string[];
  requiredClosedTrades: number;
  requiredWinRate: number;
  requiredMaxDrawdown: number;
  requiredIncidentFreeDays: number;
  requiresManualApproval: boolean;
  tradingEnabled: boolean;
}

export interface ScaleApprovalRecord {
  id: string;
  action: "PROMOTE" | "DEMOTE" | "AUTO_DEMOTE";
  fromStage: LiveScaleStage;
  toStage: LiveScaleStage;
  operatorNote: string;
  operatorApproval: boolean;
  reasons: string[];
  recordedAt: string;
}

export interface ScalePerformanceSnapshot {
  closedTrades: number;
  winRatePct: number;
  maxDrawdownPct: number;
  realizedPnlUsd: number;
  avgSlippagePct: number | null;
  incidentFreeDays: number;
}

export interface PromotionEligibility {
  targetStage: LiveScaleStage | null;
  eligible: boolean;
  blockers: string[];
  requirements: Array<{
    id: string;
    label: string;
    required: string;
    actual: string;
    met: boolean;
  }>;
}

export interface DemotionTrigger {
  id: string;
  label: string;
  active: boolean;
  severity: "warning" | "critical";
  message: string;
  autoDemote: boolean;
}

export interface StagePerformanceRow {
  stage: LiveScaleStage;
  label: string;
  closedTrades: number;
  winRatePct: number;
  realizedPnlUsd: number;
  avgNotionalUsd: number;
}

export interface ScaleUpInput {
  currentStage: LiveScaleStage;
  journal: LiveTradeJournalEntry[];
  incidents: DeskIncident[];
  readiness: LiveReadinessReport;
  realTimeRisk: RealTimeRiskReport;
  commandCenter?: CommandCenterReport | null;
  governance?: GovernanceDeskState;
  emergencyStopActive?: boolean;
  exchangeStatus?: ExchangeStatusResult | null;
  approvalHistory?: ScaleApprovalRecord[];
  entries?: DecisionLogEntry[];
  maxSlippagePct?: number;
}

export interface ScaleUpReport {
  generatedAt: string;
  currentStage: LiveScaleStage;
  currentStageDefinition: ScaleStageDefinition;
  nextStage: LiveScaleStage | null;
  tradingAllowed: boolean;
  promotion: PromotionEligibility;
  demotionTriggers: DemotionTrigger[];
  shouldAutoDemote: boolean;
  autoDemoteTarget: LiveScaleStage | null;
  autoDemoteReasons: string[];
  performance: ScalePerformanceSnapshot;
  performanceByStage: StagePerformanceRow[];
  approvalHistory: ScaleApprovalRecord[];
  safetyNotice: string;
  cannotAutoPromote: true;
  btcOptionsExcluded: true;
}

export interface PromoteStageRequest {
  targetStage: LiveScaleStage;
  operatorApproval: boolean;
  operatorNote?: string;
  reportSnapshot?: ScaleUpReport;
}

export interface DemoteStageRequest {
  targetStage?: LiveScaleStage;
  operatorNote?: string;
  reasons?: string[];
  auto?: boolean;
}

export interface ScaleStageActionResult {
  ok: boolean;
  fromStage: LiveScaleStage;
  toStage: LiveScaleStage;
  clientMustPersist: boolean;
  approvalRecord: ScaleApprovalRecord | null;
  message: string;
  error?: string;
}

export interface EffectiveScaleLimits {
  stage: LiveScaleStage;
  tradingEnabled: boolean;
  maxNotionalPerTrade: number;
  maxDailyTrades: number;
  maxDailyLoss: number;
  maxWeeklyLoss: number;
  allowedSymbols: string[];
  allowedStrategies: string[];
}
