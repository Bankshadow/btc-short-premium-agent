import type { WorkspaceRole } from "@/lib/platform/types";
import type { TradingEnvironment } from "@/lib/platform/types";
import type { GovernanceDeskState } from "@/lib/governance/governance-types";
import type { CommandCenterStatus } from "@/lib/command-center/types";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { PreMortemResult } from "@/lib/mortem/types";

export type PolicyActionType =
  | "RUN_ANALYSIS"
  | "CREATE_PAPER_TRADE"
  | "CREATE_SHADOW_TRADE"
  | "PREVIEW_LIVE_ORDER"
  | "EXECUTE_LIVE_PERP"
  | "EXECUTE_OPTIONS_TESTNET"
  | "EXECUTE_OPTIONS_LIVE"
  | "CHANGE_RISK_PROFILE"
  | "APPROVE_STRATEGY_CHANGE"
  | "ENABLE_AUTOPILOT"
  | "TRIGGER_KILL_SWITCH"
  | "PROMOTE_LIVE_STAGE";

export type PolicyDecision =
  | "ALLOW"
  | "BLOCK"
  | "REQUIRE_APPROVAL"
  | "REQUIRE_MORE_DATA";

export type PolicyRiskImpact =
  | "NONE"
  | "REDUCE"
  | "NEUTRAL"
  | "INCREASE_BLOCKED";

export interface PolicyPortfolioState {
  openTrades: number;
  exposureUsd: number;
  drawdownPct?: number;
  paperPnlPct?: number;
}

export interface PolicyRiskState {
  killSwitchActive: boolean;
  tradingPaused: boolean;
  dailyPnlPct?: number;
  hardRiskVeto?: boolean;
}

export interface PolicyDataTrustState {
  grade: string;
  score: number;
  tradeAllowed?: boolean;
  critical?: boolean;
}

export interface PolicyConflictGateState {
  blocked: boolean;
  reason?: string;
  severity?: string;
}

export interface PolicyPreMortemState {
  blocksTicket: boolean;
  level?: string;
  summary?: string;
}

export interface PolicyLiveReadinessState {
  status: "PASS" | "WARNING" | "FAIL" | string;
  blockers: string[];
  readyForPilot?: boolean;
}

export interface PolicyCommandCenterState {
  status: CommandCenterStatus | string;
  blockers: string[];
}

export interface PolicyObservabilityState {
  databaseHealthy: boolean;
  alertDeliveryHealthy: boolean;
  criticalTradingRisk: boolean;
  liveTradingPosture: "SAFE" | "CAUTION" | "BLOCKED";
}

export interface PolicyInput {
  workspaceId: string;
  userRole: WorkspaceRole;
  environmentMode: TradingEnvironment | string;
  action: PolicyActionType;
  portfolio?: PolicyPortfolioState;
  risk?: PolicyRiskState;
  governance?: GovernanceDeskState | null;
  dataTrust?: PolicyDataTrustState | null;
  conflictGate?: PolicyConflictGateState | null;
  preMortem?: PolicyPreMortemState | null;
  liveReadiness?: PolicyLiveReadinessState | null;
  commandCenter?: PolicyCommandCenterState | null;
  backboneHealthy?: boolean;
  auditAvailable?: boolean;
  operatorApproval?: boolean;
  doubleConfirm?: boolean;
  latestAnalysis?: AnalyzeApiResponse | null;
  preMortemRaw?: PreMortemResult | null;
  observability?: PolicyObservabilityState | null;
}

export interface PolicyResult {
  decision: PolicyDecision;
  reasons: string[];
  blockers: string[];
  requiredApprovals: string[];
  riskImpact: PolicyRiskImpact;
  auditRequired: boolean;
  notificationRequired: boolean;
  evaluatedAt: string;
  action: PolicyActionType;
  ruleIds: string[];
  workspaceId: string;
}

export interface PolicyRuleDefinition {
  id: string;
  label: string;
  description: string;
  appliesTo: PolicyActionType[];
  severity: "hard" | "soft";
}

export interface PolicyDecisionRecord {
  recordId: string;
  workspaceId: string;
  action: PolicyActionType;
  decision: PolicyDecision;
  blockers: string[];
  reasons: string[];
  userRole: WorkspaceRole;
  evaluatedAt: string;
}
