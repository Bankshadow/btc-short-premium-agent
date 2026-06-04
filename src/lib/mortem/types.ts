import type { AgentOutput, AgentRecommendation } from "@/lib/agents/types";
import type {
  ConflictGateResult,
  DataConfidenceResult,
  StrategyConflictAnalysis,
} from "@/lib/data-trust/types";
import type { CommitteeVerdict } from "@/lib/agents/types";
import type { ActionPlan, MarketSnapshot } from "@/lib/types/market";
import type { OrderTicket } from "@/lib/trade-control/trade-control-types";
import type { OutcomeClassification } from "@/lib/review/outcome-classifier";

export type PreMortemVerdict = "PASS" | "CAUTION" | "BLOCK";
export type PreMortemConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface PreMortemResult {
  preMortemId: string;
  tradeId?: string;
  failureScenarios: string[];
  topFailureReason: string;
  riskAmplifiers: string[];
  invalidationTriggers: string[];
  mitigationPlan: string[];
  preMortemVerdict: PreMortemVerdict;
  confidence: PreMortemConfidence;
  generatedAt: string;
}

export type LossType =
  | "EXPECTED_LOSS"
  | "RULE_VIOLATION"
  | "DATA_FAILURE"
  | "EXECUTION_FAILURE"
  | "BAD_REGIME_DETECTION"
  | "OVERCONFIDENCE"
  | "OPERATOR_OVERRIDE_LOSS"
  | "RISK_MANAGER_MISSED"
  | "UNKNOWN";

export interface LossAutopsyResult {
  autopsyId: string;
  lossType: LossType;
  rootCause: string;
  contributingFactors: string[];
  agentMistakes: string[];
  ruleFailures: string[];
  preventionSuggestion: string;
  draftRuleSuggestion?: string;
  incidentCandidate?: boolean;
  generatedAt: string;
}

export interface LearningSnapshot {
  dataTrustScore: number;
  dataTrustGrade: string;
  conflictScore: number;
  conflictLevel: string;
}

export interface RegretMetrics {
  correctTrade: number;
  falseTrade: number;
  correctSkip: number;
  falseSkip: number;
  avoidedLossR: number;
  missedOpportunityR: number;
  regretScore: number;
}

export interface PreMortemInput {
  market: MarketSnapshot;
  agentOutputs: AgentOutput[];
  riskManager: AgentOutput;
  committee: CommitteeVerdict;
  dataTrust?: DataConfidenceResult;
  conflict?: StrategyConflictAnalysis;
  conflictGate?: ConflictGateResult;
  actionPlan: ActionPlan;
  orderTicketCandidate: OrderTicket | null;
  analyzedAt: string;
}

export type { OutcomeClassification };
