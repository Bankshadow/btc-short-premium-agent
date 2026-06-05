import type { AgentRecommendation } from "@/lib/agents/types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { PaperMode } from "@/lib/paper/paper-relaxed-types";

export type MemoryNodeType =
  | "strategy"
  | "regime"
  | "agent"
  | "rule"
  | "outcome"
  | "condition"
  | "risk_event"
  | "trade_outcome"
  | "proposal";

export type MemoryEdgeRelation =
  | "performs_well_in"
  | "performs_poorly_in"
  | "agent_wrong_under"
  | "agent_accurate_under"
  | "rule_prevented_loss"
  | "rule_missed_opportunity"
  | "condition_increased_drawdown"
  | "proposal_changed_strategy"
  | "linked_to_decision"
  | "reflection_supports"
  | "incident_caused_by";

export interface MemoryNodeBase {
  id: string;
  type: MemoryNodeType;
  label: string;
  summary: string;
  weight: number;
  sourceIds: string[];
  tags: string[];
  createdAt: string;
}

export interface StrategyMemoryNode extends MemoryNodeBase {
  type: "strategy";
  strategyKey: string;
  winRate?: number;
  avgPnl?: number;
}

export interface AgentPerformanceMemoryNode extends MemoryNodeBase {
  type: "agent";
  agentName: string;
  falsePositives?: number;
  falseNegatives?: number;
}

export interface RegimeMemoryNode extends MemoryNodeBase {
  type: "regime";
  regimeKey: string;
  sampleSize: number;
  winRate: number;
}

export interface RiskEventMemoryNode extends MemoryNodeBase {
  type: "risk_event";
  severity: string;
  incidentType?: string;
}

export interface RuleMemoryNode extends MemoryNodeBase {
  type: "rule";
  ruleId: string;
  status: string;
}

export interface TradeOutcomeMemoryNode extends MemoryNodeBase {
  type: "trade_outcome";
  outcome: "win" | "loss" | "neutral";
  pnlPct: number;
  decisionLogId: string;
}

export type MemoryNode =
  | StrategyMemoryNode
  | AgentPerformanceMemoryNode
  | RegimeMemoryNode
  | RiskEventMemoryNode
  | RuleMemoryNode
  | TradeOutcomeMemoryNode
  | MemoryNodeBase;

export interface MemoryEdge {
  id: string;
  from: string;
  to: string;
  relation: MemoryEdgeRelation;
  weight: number;
  evidence: string;
  createdAt: string;
}

export interface MemoryGraphSnapshot {
  generatedAt: string;
  nodeCount: number;
  edgeCount: number;
  nodes: MemoryNode[];
  edges: MemoryEdge[];
  topLessons: string[];
  safetyNotice: string;
}

export interface RelevantMemoryContext {
  marketRegime?: string;
  asset?: string;
  strategy?: string;
  agentsInvolved?: string[];
  riskProfile?: DeskRiskProfile;
  paperMode?: PaperMode;
  currentVerdict?: AgentRecommendation;
  limit?: number;
}

export interface RelevantMemoryLesson {
  bullet: string;
  score: number;
  whyUsed: string;
  nodeIds: string[];
  edgeIds: string[];
}

export interface RelevantMemoryResult {
  generatedAt: string;
  lessons: RelevantMemoryLesson[];
  nodes: MemoryNode[];
  edges: MemoryEdge[];
  advisoryOnly: true;
  cannotPlaceTrades: true;
  cannotBypassGovernance: true;
}

export interface MemoryGraphBuildInput {
  entries: import("@/lib/journal/decision-log-types").DecisionLogEntry[];
  orders?: import("@/lib/paper/paper-order-types").PaperOrder[];
  draftRules?: import("@/lib/journal/draft-rules").DraftRule[];
  pinnedNotes?: string[];
  incidents?: import("@/lib/governance/governance-types").DeskIncident[];
  councilSessions?: import("@/lib/council/types").CouncilSessionResult[];
  adaptationProposals?: import("@/lib/strategy-adaptation/types").StrategyAdaptationProposal[];
  registryStrategies?: import("@/lib/strategy-registry/strategy-registry-types").StrategySkill[];
}
