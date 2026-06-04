import type { AgentOutput, AgentRecommendation } from "@/lib/agents/types";
import type { TradeRecommendation } from "@/lib/types/market";

/** Compact desk state stored per decision log entry (MVP 6 replay). */
export interface DeskReplaySnapshot {
  analyzedAt: string;
  btcPrice: number;
  marketRegime: string;
  committeeVerdict: AgentRecommendation;
  riskVeto: boolean;
  topReasons: string[];
  actionPlan: string;
  playbookRecommendation: TradeRecommendation;
  researchBullets: string[];
  agentOutputs: AgentOutput[];
}
