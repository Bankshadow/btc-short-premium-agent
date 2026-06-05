import type { DeskAutomationResult } from "@/lib/automation/automation-types";
import type { GovernanceDeskState } from "@/lib/governance/governance-types";
import type { MemoryGraphSnapshot } from "@/lib/memory-graph/types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { PerpPaperPosition } from "@/lib/multi-asset/types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { TradeEvaluationResult } from "@/lib/self-learning/types";
import type { AutoDiscoveredRuleProposal } from "@/lib/rule-discovery/types";
import type { StrategyAdaptationProposal } from "@/lib/strategy-adaptation/types";
import type { StrategyExperiment } from "@/lib/strategy-experiments/types";
import type { DeskIncident } from "@/lib/governance/governance-types";
import type { CouncilSessionResult } from "@/lib/council/types";
import type { StrategySkill } from "@/lib/strategy-registry/strategy-registry-types";

export const DESK_MANAGER_SAFETY_NOTICE =
  "Autonomous Desk Manager coordinates learning and ops cycles only — cannot place live trades, approve its own proposals, disable kill switch, or increase live risk. All material actions require human approval.";

export type DeskManagerCycleType =
  | "operational"
  | "daily_learning"
  | "weekly_strategy_review";

export type DeskManagerActionType =
  | "REVIEW_TRADE"
  | "APPROVE_RULE"
  | "REVIEW_STRATEGY"
  | "PAUSE_STRATEGY"
  | "RUN_EXPERIMENT"
  | "CLOSE_EXPERIMENT"
  | "ESCALATE_RISK"
  | "SEND_BRIEFING"
  | "NO_ACTION";

export type DeskManagerActionStatus = "PENDING" | "RESOLVED" | "DISMISSED";

export type DeskManagerActionPriority = "HIGH" | "MEDIUM" | "LOW";

export interface DeskManagerAction {
  actionId: string;
  type: DeskManagerActionType;
  priority: DeskManagerActionPriority;
  reason: string;
  evidence: string[];
  linkedTrades: string[];
  linkedAgents: string[];
  linkedProposals: string[];
  status: DeskManagerActionStatus;
  requiresApproval: true;
  createdAt: string;
  resolvedAt: string | null;
  runId: string;
}

export interface OperatorBriefing {
  generatedAt: string;
  headline: string;
  marketSnapshot: string;
  keyFindings: string[];
  topActions: string[];
  riskNotes: string[];
  learningHighlights: string[];
  experimentNotes: string[];
  safetyNotice: string;
}

export interface LearningSummary {
  newEvaluations: number;
  totalEvaluations: number;
  topAgent: string | null;
  weakestAgent: string | null;
  newRecommendations: number;
  leaderboardSummary: string;
  agentUpdates: string[];
}

export interface RiskSummary {
  safeMode: boolean;
  pauseAnalysis: boolean;
  hardRulesLocked: boolean;
  activeHardRules: string[];
  escalationLevel: "NONE" | "WATCH" | "ELEVATED" | "CRITICAL";
  notes: string[];
}

export interface AutomationTimelineEntry {
  step: string;
  status: "ok" | "skipped" | "error";
  durationMs: number;
  detail: string;
}

export interface DeskManagerSettings {
  enabled: boolean;
  operationalIntervalMinutes: number;
  dailyLearningHourUtc: number;
  weeklyStrategyReviewDay: number;
  lastOperationalRunAt: string | null;
  lastDailyLearningRunAt: string | null;
  lastWeeklyReviewRunAt: string | null;
  chainWithDeskAutomation: boolean;
}

export const DEFAULT_DESK_MANAGER_SETTINGS: DeskManagerSettings = {
  enabled: true,
  operationalIntervalMinutes: 15,
  dailyLearningHourUtc: 6,
  weeklyStrategyReviewDay: 1,
  lastOperationalRunAt: null,
  lastDailyLearningRunAt: null,
  lastWeeklyReviewRunAt: null,
  chainWithDeskAutomation: true,
};

export interface DeskManagerInput {
  cycleType?: DeskManagerCycleType;
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
  perpPositions?: PerpPaperPosition[];
  riskProfile?: DeskRiskProfile;
  governanceState?: GovernanceDeskState;
  storedEvaluations?: TradeEvaluationResult[];
  storedRuleProposals?: AutoDiscoveredRuleProposal[];
  storedAdaptationProposals?: StrategyAdaptationProposal[];
  experiments?: StrategyExperiment[];
  incidents?: DeskIncident[];
  councilSessions?: CouncilSessionResult[];
  registryStrategies?: StrategySkill[];
  lastManagerRunAt?: string | null;
  /** Reuse automation output when chained from desk automation */
  automationResult?: DeskAutomationResult | null;
}

export interface DeskManagerRunResult {
  runId: string;
  cycleType: DeskManagerCycleType;
  timestamp: string;
  blocked: boolean;
  blockReason?: string;
  briefing: OperatorBriefing;
  actionQueue: DeskManagerAction[];
  learningSummary: LearningSummary;
  riskSummary: RiskSummary;
  timeline: AutomationTimelineEntry[];
  automation: DeskAutomationResult | null;
  memoryGraphUpdated: boolean;
  safetyNotice: string;
  clientMustPersist?: {
    evaluations?: TradeEvaluationResult[];
    ruleProposals?: AutoDiscoveredRuleProposal[];
    adaptationProposals?: StrategyAdaptationProposal[];
    memoryGraph?: MemoryGraphSnapshot;
  };
}

export interface DeskManagerStatus {
  settings: DeskManagerSettings;
  lastRun: DeskManagerRunResult | null;
  pendingActionCount: number;
  nextScheduledCycles: {
    operational: string | null;
    dailyLearning: string | null;
    weeklyReview: string | null;
  };
}

export interface ResolveDeskManagerActionInput {
  actionId: string;
  status: "RESOLVED" | "DISMISSED";
  note?: string;
}
