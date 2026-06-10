export type AdvisorySignal = "BULLISH" | "BEARISH" | "NEUTRAL" | "RISK_OFF";
export type RecommendedAction = "WAIT" | "WATCH" | "REDUCE_RISK" | "ALLOW_ANALYSIS";

export interface AgentVote {
  agentId: string;
  role: string;
  vote: AdvisorySignal;
  confidence: number;
  reasoning: string;
  riskNotes: string;
}

export interface ScenarioSwarmReport {
  reportId: string;
  runId: string;
  createdAt: string;
  likelyScenario: string;
  upsideScenario: string;
  downsideScenario: string;
  liquidityTrapRisk: string;
  volatilityRisk: string;
  invalidationPoints: string[];
  keyLevels: string[];
  agentVotes: AgentVote[];
  confidence: number;
  advisorySignal: AdvisorySignal;
  recommendedAction: RecommendedAction;
  safetyNote: string;
}

export interface SwarmRunResult {
  ok: boolean;
  report: ScenarioSwarmReport | null;
  message: string;
}
