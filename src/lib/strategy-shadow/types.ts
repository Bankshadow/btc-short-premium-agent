import type { AgentRecommendation } from "@/lib/agents/types";
import type { QuantImportStatus } from "@/lib/quant-strategy-importer/types";

export const STRATEGY_SHADOW_SAFETY_NOTICE =
  "Strategy shadow mode never places orders and cannot count as live proof. Virtual trades only — evaluate before testnet.";

export const AI_COMMITTEE_SOURCE_ID = "ai-committee";
export const AI_COMMITTEE_STRATEGY_NAME = "AI Investment Committee";

export type ShadowTradeSide = "LONG" | "SHORT" | "FLAT";
export type ShadowTradeResult = "WIN" | "LOSS" | "BREAKEVEN" | "OPEN";
export type ShadowStrategySource = "quant_import" | "ai_committee";

export interface StrategyShadowTrade {
  id: string;
  sourceType: ShadowStrategySource;
  strategyName: string;
  sourceId: string;
  symbol: string;
  side: ShadowTradeSide;
  entryPrice: number;
  virtualExit: number | null;
  virtualPnL: number | null;
  result: ShadowTradeResult;
  createdAt: string;
  closedAt: string | null;
  decisionLogId?: string | null;
  committeeVerdict?: AgentRecommendation | null;
  alignedWithCommittee?: boolean;
  falsePositive?: boolean;
  falseNegative?: boolean;
  importStatus?: QuantImportStatus;
  advisoryOnly: true;
  executionBlocked: true;
  cannotCountAsLiveProof: true;
}

export interface ShadowStrategyMetrics {
  sourceId: string;
  strategyName: string;
  sourceType: ShadowStrategySource;
  sampleSize: number;
  closedTrades: number;
  openTrades: number;
  winRate: number;
  shadowPnL: number;
  maxDrawdownPct: number;
  falsePositives: number;
  falseNegatives: number;
  avgVirtualPnL: number;
}

export interface AiTradeComparison {
  aiSampleSize: number;
  aiWinRate: number;
  aiPnL: number;
  shadowWinRate: number;
  shadowPnL: number;
  winRateDelta: number;
  pnlDelta: number;
  falsePositives: number;
  falseNegatives: number;
  summary: string;
}

export interface ShadowPromotionCandidate {
  sourceId: string;
  strategyName: string;
  importStatus: QuantImportStatus;
  metrics: ShadowStrategyMetrics;
  eligible: boolean;
  blockers: string[];
  humanApprovalRequired: true;
  cannotCountAsLiveProof: true;
}

export interface StrategyShadowReport {
  generatedAt: string;
  symbol: string;
  lookbackDays: number;
  trades: StrategyShadowTrade[];
  byStrategy: ShadowStrategyMetrics[];
  aiCommittee: ShadowStrategyMetrics | null;
  comparison: AiTradeComparison | null;
  promotionCandidates: ShadowPromotionCandidate[];
  safetyNotice: string;
  neverPlacesOrders: true;
  cannotCountAsLiveProof: true;
}

export interface RunShadowInput {
  symbol?: "BTCUSDT" | "SOLUSDT";
  lookbackDays?: number;
  mode?: "replay" | "forward";
  includeRejected?: boolean;
}

export interface PromoteShadowInput {
  sourceId: string;
  humanApproval: boolean;
  operatorNote?: string;
  targetStatus?: "READY_FOR_BACKTEST" | "READY_FOR_PAPER";
}

export const SHADOW_PROMOTION_RULES = {
  minSampleSize: 10,
  maxDrawdownPct: 15,
  minWinRate: 45,
} as const;
