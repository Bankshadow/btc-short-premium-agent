export interface OperatorBehaviorAnalytics {
  operatorDisciplineScore: number;
  overrideCount: number;
  overrideWinRate: number;
  overrideLossImpactR: number;
  emotionalTradingWarnings: string[];
  recommendations: string[];
  overridesAfterLossStreak: number;
  overridesInAggressiveMode: number;
  rejectedAiTradeIdeas: number;
  incidentCandidate: boolean;
}

export interface OperatorDisciplineReport extends OperatorBehaviorAnalytics {
  grade: "A" | "B" | "C" | "D";
  requireStrongerConfirmation: boolean;
  suggestCooldown: boolean;
}
