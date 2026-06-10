import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { AutopilotRunResult } from "@/lib/autopilot/types";
import type { BinanceOrderPreview } from "@/lib/exchange/binance/binance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { AnalysisContext } from "./analysis-state";

export type AnalysisFinalVerdict = "TRADE" | "WAIT" | "SKIP" | "HOLD";

export interface AnalysisTradeCandidate {
  symbol: string | null;
  side: string | null;
  notionalUsd: number | null;
  previewId: string | null;
  requiresDoubleConfirm: true;
}

export interface AnalysisMissionImpact {
  progressPct: number | null;
  evidenceCompleted: number | null;
  pendingLearning: number | null;
}

export interface AnalysisLearningImpact {
  pendingReviewCount: number;
  learnedCount: number;
  headline: string | null;
}

export interface AnalysisAuditEvent {
  id: string;
  type: string;
  detail: string;
  timestamp: string;
  linkedDecisionLogId: string | null;
}

/** Unified output from the central analysis engine. */
export interface AnalysisResult {
  runId: string;
  decisionLogId: string;
  generatedAt: string;
  finalVerdict: AnalysisFinalVerdict;
  confidence: number;
  tradeCandidate: AnalysisTradeCandidate | null;
  riskStatus: "SAFE" | "CAUTION" | "BLOCKED";
  blockers: string[];
  reasons: string[];
  nextAction: string;
  humanActionRequired: boolean;
  aiState: "IDLE" | "ANALYZING" | "MONITORING" | "WAITING" | "BLOCKED";
  missionImpact: AnalysisMissionImpact;
  reportSummary: string;
  learningImpact: AnalysisLearningImpact;
  auditEvents: AnalysisAuditEvent[];
  liveTradingLocked: true;
  autoExecuteBlocked: true;
  /** Raw analyze response for adapters — not for UI direct use. */
  analyzeResponse?: AnalyzeApiResponse;
  journalEntry?: DecisionLogEntry;
  autopilot?: AutopilotRunResult;
  testnetPreview?: BinanceOrderPreview | null;
  context?: AnalysisContext;
}

export function resolveFinalVerdictFromAnalysis(
  analysis: AnalyzeApiResponse,
  entry?: DecisionLogEntry,
): AnalysisFinalVerdict {
  const raw =
    analysis.tradingDesk?.weightedCommittee?.weightedVerdict ??
    analysis.step5_verdict?.recommendation ??
    entry?.finalVerdict ??
    "WAIT";
  const v = String(raw).toUpperCase();
  if (v === "TRADE" || v === "WAIT" || v === "SKIP" || v === "HOLD") {
    return v;
  }
  return "WAIT";
}

export function resolveConfidenceFromAnalysis(analysis: AnalyzeApiResponse): number {
  const committeeScore = analysis.tradingDesk?.weightedCommittee?.tradeScore;
  if (typeof committeeScore === "number" && committeeScore > 0) {
    return Math.round(Math.min(100, committeeScore));
  }
  return analysis.step5_verdict?.confidence ?? 0;
}

export function buildReportSummary(result: Pick<
  AnalysisResult,
  "finalVerdict" | "confidence" | "blockers" | "reasons"
>): string {
  const parts = [
    `Verdict ${result.finalVerdict}`,
    `confidence ${result.confidence}%`,
  ];
  if (result.blockers.length > 0) {
    parts.push(`blocked: ${result.blockers[0]}`);
  } else if (result.reasons[0]) {
    parts.push(result.reasons[0]);
  }
  return parts.join(" · ");
}
