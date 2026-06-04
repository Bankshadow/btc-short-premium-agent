import type { AgentOutput } from "@/lib/agents/types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { DraftRule } from "@/lib/journal/draft-rules";

/** Client → server payload for memory-aware analyze (browser only). */
export interface DeskMemoryClientPayload {
  pinnedNotes?: string[];
  recentLogs?: DecisionLogEntry[];
  draftRules?: DraftRule[];
}

export interface DeskMemoryBuckets {
  regimeHistory: string[];
  scoreboardHints: string[];
  approvedPlaybookHints: string[];
  pinnedNotes: string[];
  reflectionLearnings: string[];
}

/** Read-only context for agents — never overrides hard risk veto. */
export interface DeskMemorySnapshot {
  generatedAt: string;
  currentRegime: string;
  bullets: string[];
  buckets: DeskMemoryBuckets;
  /** Advisory only — not wired into no-trade engine */
  approvedRuleCount: number;
  resolvedCount: number;
  pendingCount: number;
  agent: AgentOutput;
}
