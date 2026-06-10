export type ImprovementProposalType =
  | "ADD_NO_TRADE_RULE"
  | "ADJUST_AGENT_WEIGHT"
  | "LOWER_NOTIONAL_LIMIT"
  | "ADD_REGIME_WARNING"
  | "PAUSE_SETUP"
  | "CHANGE_RISK_MODE";

export type ImprovementStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface ImprovementProposal {
  improvementId: string;
  type: ImprovementProposalType;
  title: string;
  description: string;
  evidence: string[];
  tradeIds: string[];
  status: ImprovementStatus;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
}
