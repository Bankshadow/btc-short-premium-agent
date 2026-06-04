import type { AgentOutput, AgentRecommendation } from "@/lib/agents/types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { DeskReplaySnapshot } from "@/lib/replay/replay-types";
import type {
  LossAutopsyResult,
  LearningSnapshot,
  PreMortemResult,
} from "@/lib/mortem/types";
import type { OutcomeClassification } from "@/lib/review/outcome-classifier";
import type {
  OrderTicket,
  TradeControlState,
} from "@/lib/trade-control/trade-control-types";

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
  /** MVP 10 — risk profile at session time */
  deskRiskProfile?: DeskRiskProfile;
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
    operatorName?: string;
    originalVerdict?: AgentRecommendation;
    riskVetoState?: boolean;
  } | null;
  /** MVP 11 — semi-live trade ticket */
  orderTicket?: OrderTicket | null;
  tradeControl?: TradeControlState | null;
  /** MVP 18 — pre-mortem before TRADE ticket */
  preMortem?: PreMortemResult | null;
  /** MVP 18 — loss autopsy after losing resolve */
  autopsy?: LossAutopsyResult | null;
  regretClassification?: OutcomeClassification | null;
  falseTradeFlag?: boolean;
  falseSkipFlag?: boolean;
  missedOpportunityR?: number;
  avoidedLossR?: number;
  lessonTags?: string[];
  learningSnapshot?: LearningSnapshot | null;
}

export interface ResolveOutcomeInput {
  btcPriceAfter: number;
  tradeWouldWin: boolean | null;
  notes: string;
}
