import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import type { StrategyId } from "@/lib/validation/validation-types";

export interface ExecutionQualityInput {
  testnetJournal: BinanceTestnetJournalEntry[];
  liveTrades?: LiveTradeJournalEntry[];
}

export interface ExecutionQualitySymbolRow {
  symbol: string;
  attempts: number;
  avgSlippageBps: number;
  rejectionRatePct: number;
  failedCloseRatePct: number;
  partialFillRatePct: number;
  avgLatencyMs: number;
  feeImpactUsd: number;
}

export interface ExecutionQualityStrategyRow {
  strategyId: StrategyId;
  attempts: number;
  avgSlippageBps: number;
  rejectionRatePct: number;
  reliabilityPct: number;
}

export interface ExecutionLatencyPoint {
  bucket: string;
  avgLatencyMs: number;
  attempts: number;
}

export interface ExecutionErrorRow {
  error: string;
  count: number;
  lastSeenAt: string;
  symbol: string | null;
}

export interface ExecutionQualitySummary {
  generatedAt: string;
  averageSlippageBps: number;
  averageLatencyMs: number;
  rejectionRatePct: number;
  failedCloseRatePct: number;
  partialFillRatePct: number;
  duplicateSubmissionCount: number;
  retryCountTotal: number;
  feeImpactUsd: number;
  failedOrderCount: number;
  closeFailureCount: number;
  slippageBySymbol: ExecutionQualitySymbolRow[];
  latencyTrend: ExecutionLatencyPoint[];
  exchangeErrors: ExecutionErrorRow[];
  byStrategy: ExecutionQualityStrategyRow[];
  liveQualityGate: {
    status: "PASS" | "WARNING" | "FAIL";
    reasons: string[];
    blocksLiveReadiness: boolean;
  };
  safetyNotice: string;
}

