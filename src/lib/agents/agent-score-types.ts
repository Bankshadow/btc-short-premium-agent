export interface AgentScoreEntry {
  agentId: string;
  role: string;
  predictionAccuracy: number;
  confidenceCalibration: number;
  falseBullish: number;
  falseBearish: number;
  riskWarningUsefulness: number;
  regimePerformance: Record<string, number>;
  overconfidenceDetected: boolean;
  totalEvaluations: number;
  updatedAt: string;
}

export interface AgentScoreboard {
  generatedAt: string;
  agents: AgentScoreEntry[];
  advisoryOnly: true;
  liveLocked: true;
  message: string;
}
