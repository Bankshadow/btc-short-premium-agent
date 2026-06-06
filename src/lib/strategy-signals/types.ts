import type { SuggestedUse } from "@/lib/quant-strategy-importer/types";

export const STRATEGY_SIGNAL_SAFETY_NOTICE =
  "Approved quant strategy signals are advisory inputs only. They cannot bypass risk veto, auto-execute, or enable live trading.";

export type StrategySignalDirection = "LONG" | "SHORT" | "FLAT";

export type StrategySignalConfidence = "HIGH" | "MEDIUM" | "LOW";

export type StrategyAgentFeedTarget =
  | "MARKET_DATA"
  | "FUTURES"
  | "OPTIONS"
  | "RISK_MANAGER"
  | "COMMITTEE";

export interface AdvisoryStrategySignal {
  sourceId: string;
  strategyName: string;
  suggestedUse: SuggestedUse;
  signal: StrategySignalDirection;
  confidence: StrategySignalConfidence;
  regimeFit: string[];
  reasons: string[];
  risks: string[];
  invalidationCondition: string;
  fedTo: StrategyAgentFeedTarget[];
  importStatus: string;
  advisoryOnly: true;
  executionBlocked: true;
  cannotBypassRiskVeto: true;
  generatedAt: string;
}

export interface StrategySignalsPayload {
  signals: AdvisoryStrategySignal[];
  safetyNotice: string;
  approvedCount: number;
}
