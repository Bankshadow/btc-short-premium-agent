import type { QuantImportStatus, SuggestedUse } from "@/lib/quant-strategy-importer/types";
import type { AiPaperRecommendation } from "@/lib/quant-backtest/types";

export const STRATEGY_GARAGE_SAFETY_NOTICE =
  "Strategy Garage is research-only. Imported strategies cannot execute trades directly. Human approval is required before any strategy enters the AI decision loop.";

export type StrategyGarageStage =
  | "IMPORTED"
  | "AI_REVIEWED"
  | "BACKTEST_READY"
  | "SHADOW_TESTING"
  | "TESTNET_READY"
  | "APPROVED_FOR_USE"
  | "REJECTED";

export type StrategyGarageRiskClass = "LOW" | "MEDIUM" | "HIGH" | "EXTREME";

export type StrategyGarageImportSource = "github" | "link" | "manual" | "quant_seed";

export interface GarageBacktestSummary {
  runId: string;
  symbol: string;
  timeframe: string;
  aiVerdict: AiPaperRecommendation;
  winRate: number;
  netPnlPct: number;
  maxDrawdownPct: number;
  tradeCount: number;
  completedAt: string;
}

export interface GarageShadowSummary {
  closedTrades: number;
  winRate: number;
  shadowPnL: number;
  eligibleForPromotion: boolean;
  blockers: string[];
}

export interface StrategyGarageRecord {
  sourceId: string;
  stage: StrategyGarageStage;
  importSource: StrategyGarageImportSource;
  riskClass: StrategyGarageRiskClass;
  aiReviewSummary: string | null;
  aiReviewedAt: string | null;
  approvedForAiLoop: boolean;
  approvedForAiLoopAt: string | null;
  lastBacktest: GarageBacktestSummary | null;
  lastShadow: GarageShadowSummary | null;
  importStatus: QuantImportStatus;
  operatorNote: string | null;
  updatedAt: string;
}

export interface GarageCustomStrategy {
  sourceId: string;
  sourceUrl: string;
  repoName: string;
  strategyName: string;
  category: string;
  description: string;
  thesis: string;
  originalAssumptions: string[];
  riskNotes: string[];
  marketRegimeFit: string[];
  cryptoAdaptationNotes: string[];
  requiredData: string[];
  riskWarning: string;
  suggestedUse: SuggestedUse;
  importSource: StrategyGarageImportSource;
  importedAt: string;
}

export interface StrategyGarageCard {
  sourceId: string;
  strategyName: string;
  category: string;
  description: string;
  sourceUrl: string;
  importSource: StrategyGarageImportSource;
  stage: StrategyGarageStage;
  riskClass: StrategyGarageRiskClass;
  suggestedUse: SuggestedUse;
  aiReviewSummary: string | null;
  thesis: string;
  importStatus: QuantImportStatus;
  approvedForAiLoop: boolean;
  humanApprovalRequired: true;
  executionBlocked: true;
  lastBacktest: GarageBacktestSummary | null;
  lastShadow: GarageShadowSummary | null;
  backtestUrl: string | null;
  shadowUrl: string;
  canPromote: boolean;
  canReject: boolean;
  canApproveForAiLoop: boolean;
  nextAction: string;
}

export interface StrategyGarageCatalog {
  generatedAt: string;
  safetyNotice: string;
  analysisOnly: true;
  noDirectExecution: true;
  humanApprovalRequiredForAiLoop: true;
  strategies: StrategyGarageCard[];
  stageCounts: Record<StrategyGarageStage, number>;
}

export interface ImportGarageStrategyInput {
  importSource: "github" | "link" | "manual";
  sourceUrl?: string;
  strategyName: string;
  description: string;
  thesis?: string;
  category?: string;
  riskNotes?: string[];
}

export interface PromoteGarageInput {
  sourceId: string;
  targetStage: StrategyGarageStage;
  humanApproval: boolean;
  operatorNote?: string;
}

export interface PromoteGarageResult {
  ok: boolean;
  message: string;
  card: StrategyGarageCard | null;
  executionBlocked: true;
}
