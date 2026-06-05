import type { AgentRecommendation } from "@/lib/agents/types";

export type PaperMode = "STRICT_PAPER" | "RELAXED_PAPER";

export interface RelaxedPaperSettings {
  paperMode: PaperMode;
  relaxedMinConfidence: number;
  relaxedMaxPositionSizePct: number;
  relaxedRequireOptionsAgentAgree: boolean;
  relaxedAllowWaitToPaperTrade: boolean;
}

export const DEFAULT_RELAXED_PAPER_SETTINGS: RelaxedPaperSettings = {
  paperMode: "STRICT_PAPER",
  relaxedMinConfidence: 52,
  relaxedMaxPositionSizePct: 1,
  relaxedRequireOptionsAgentAgree: true,
  relaxedAllowWaitToPaperTrade: true,
};

export interface PaperRelaxedMetadata {
  paperMode: PaperMode;
  relaxedReason?: string;
  strictVerdict: AgentRecommendation;
  relaxedVerdict: AgentRecommendation;
}

export type PaperHardBlockReason =
  | "RISK_VETO"
  | "GOVERNANCE_KILL_SWITCH"
  | "DATA_TRUST_CRITICAL"
  | "PRE_MORTEM_BLOCK"
  | "LIQUIDATION_RULE"
  | "MACRO_EVENT_BLOCK"
  | "NO_TRADE_INSTRUMENT"
  | "INVALID_TAPE"
  | "RISK_BUDGET";

export interface PaperOpenEligibility {
  eligible: boolean;
  paperMode: PaperMode;
  strictVerdict: AgentRecommendation;
  relaxedVerdict: AgentRecommendation;
  relaxedReason: string | null;
  hardBlock: PaperHardBlockReason | null;
  hardBlockDetail: string | null;
  sizePctCap: number;
}

export interface RelaxedPaperAnalytics {
  strictWouldHaveSkipped: number;
  relaxedEntered: number;
  closedCount: number;
  relaxedWinRate: number;
  relaxedRegretScore: number;
  avgRelaxedPnlPct: number;
  entries: RelaxedPaperAnalyticsRow[];
}

export interface RelaxedPaperAnalyticsRow {
  orderId: string;
  decisionLogId: string;
  strictVerdict: AgentRecommendation;
  relaxedVerdict: AgentRecommendation;
  relaxedReason: string | null;
  outcomePnlPct: number | null;
  outcomeWin: boolean | null;
  closedAt: string | null;
}
