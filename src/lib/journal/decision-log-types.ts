import type { AgentOutput, AgentRecommendation } from "@/lib/agents/types";
import type { DeskReplaySnapshot } from "@/lib/replay/replay-types";

export type OutcomeStatus = "PENDING" | "RESOLVED";

export interface PaperResolution {
  btcPriceAfter: number;
  /** null = not applicable (e.g. SKIP with no hypothetical trade) */
  tradeWouldWin: boolean | null;
  notes: string;
  resolvedAt: string;
}

export interface StructuredReflection {
  whatWasCorrect: string[];
  whatWasWrong: string[];
  tooAggressiveAgents: string[];
  helpfulRiskRules: string[];
  suggestedDraftRule: string;
  generatedAt: string;
}

export interface DecisionLogEntry {
  id: string;
  timestamp: string;
  btcPrice: number;
  marketRegime: string;
  agentOutputs: AgentOutput[];
  finalVerdict: AgentRecommendation;
  riskVeto: boolean;
  topReasons: string[];
  actionPlan: string;
  outcomeStatus: OutcomeStatus;
  paperPnl: number | null;
  reflection: StructuredReflection | null;
  resolution?: PaperResolution;
  /** MVP 6 — frozen desk state for replay panel */
  replaySnapshot?: DeskReplaySnapshot | null;
  /** MVP 9 — operator audit (does not change engine) */
  operatorOverride?: {
    disagreeWithVerdict: AgentRecommendation;
    reason: string;
    createdAt: string;
  } | null;
}

export interface ResolveOutcomeInput {
  btcPriceAfter: number;
  tradeWouldWin: boolean | null;
  notes: string;
}
