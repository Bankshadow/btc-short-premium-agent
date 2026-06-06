export const SECOND_BRAIN_SAFETY_NOTICE =
  "Second brain memory is advisory only — cannot bypass risk gates or enable live trading.";

export type SecondBrainMemoryType =
  | "TradeLesson"
  | "StrategyPattern"
  | "RiskPattern"
  | "ExecutionIssue"
  | "UserPreference"
  | "ProjectDecision"
  | "SkillUpdate";

export type MemoryPolarity = "positive" | "negative" | "neutral";

export interface SecondBrainMemory {
  memoryId: string;
  type: SecondBrainMemoryType;
  title: string;
  lesson: string;
  polarity: MemoryPolarity;
  confidence: number;
  conflictKey: string;
  tags: string[];
  sourceModule: string | null;
  linkedDecisionId: string | null;
  linkedTradeId: string | null;
  createdAt: string;
  updatedAt: string;
  consolidatedAt: string | null;
  superseded: boolean;
  supersededBy: string | null;
}

export interface ConsciousMemorySnapshot {
  updatedAt: string;
  openPositions: string[];
  currentStrategy: string | null;
  riskState: string;
  latestAiDecision: string | null;
  blockers: string[];
}

export interface SecondBrainCycleSnapshot {
  generatedAt: string;
  conscious: ConsciousMemorySnapshot;
  relevantLessons: SecondBrainRelevantLesson[];
  summaryHeadline: string;
  advisoryOnly: true;
  cannotBypassRisk: true;
  cannotEnableLive: true;
}

export interface SecondBrainRelevantLesson {
  memoryId: string;
  type: SecondBrainMemoryType;
  title: string;
  lesson: string;
  score: number;
  whyUsed: string;
}

export interface SecondBrainGraphNode {
  id: string;
  layer: "conscious" | "subconscious";
  type: string;
  label: string;
  summary: string;
  weight: number;
}

export interface SecondBrainGraphEdge {
  id: string;
  from: string;
  to: string;
  relation: "supports" | "warns" | "relates" | "resolved_conflict";
  evidence: string;
}

export interface SecondBrainGraphView {
  generatedAt: string;
  nodes: SecondBrainGraphNode[];
  edges: SecondBrainGraphEdge[];
  safetyNotice: string;
}

export interface SecondBrainState {
  workspaceId: string;
  memories: SecondBrainMemory[];
  conscious: ConsciousMemorySnapshot | null;
  lastConsolidatedAt: string | null;
  lastCycleAt: string | null;
  lastCycleSnapshot: SecondBrainCycleSnapshot | null;
  consolidationRuns: number;
  conflictsResolved: number;
  updatedAt: string;
}

export interface SecondBrainMemorySummary {
  headline: string;
  consciousHighlights: string[];
  topLessons: string[];
  lessonCount: number;
  subconsciousCount: number;
  lastConsolidatedAt: string | null;
  lastCycleAt: string | null;
}

export interface ConsolidateSecondBrainResult {
  added: number;
  updated: number;
  conflictsResolved: number;
  totalMemories: number;
  consolidatedAt: string;
}
