export interface AgentProposal {
  agentId: string;
  role: string;
  proposal: string;
  confidence: number;
  createdAt: string;
}

export interface AgentCritique {
  agentId: string;
  role: string;
  targetAgentId: string;
  critique: string;
  severity: "INFO" | "WARN" | "BLOCK";
  createdAt: string;
}

export interface CommitteeSummary {
  collaborationId: string;
  runId: string;
  proposals: AgentProposal[];
  critiques: AgentCritique[];
  dissentingViews: string[];
  finalRecommendation: "TRADE" | "WAIT" | "BLOCKED";
  riskNotes: string[];
  advisoryOnly: true;
  createdAt: string;
}
