import { agentRecToTrade } from "@/lib/agents/types";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import {
  buildDecisionLogEntry,
  type DecisionLogEntry,
} from "@/lib/journal/decision-log";
import {
  resolveConfidenceLevel,
  type ConfidenceLevel,
} from "@/lib/decision/verdict-display";

export interface CronAnalyzeResponse {
  timestamp: string;
  verdict: ReturnType<typeof agentRecToTrade>;
  committeeVerdict: DecisionLogEntry["finalVerdict"];
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  btcPrice: number;
  marketRegime: string;
  riskVeto: boolean;
  topReasons: string[];
  actionSummary: string;
  dataSourceIssues: AnalyzeApiResponse["dataSourceIssues"];
  telegramSent?: boolean;
  supabaseSaved?: boolean;
  supabaseRunId?: string;
  warnings?: string[];
  test?: boolean;
}

export function buildCronAnalyzeResponse(
  data: AnalyzeApiResponse,
  options: { test?: boolean } = {},
): CronAnalyzeResponse {
  const entry = buildDecisionLogEntry(data);
  const tradeVerdict = agentRecToTrade(entry.finalVerdict);
  const engineConfidence = data.step5_verdict.confidence;

  return {
    timestamp: entry.timestamp,
    verdict: tradeVerdict,
    committeeVerdict: entry.finalVerdict,
    confidence: engineConfidence,
    confidenceLevel: resolveConfidenceLevel(engineConfidence, tradeVerdict),
    btcPrice: entry.btcPrice,
    marketRegime: entry.marketRegime,
    riskVeto: entry.riskVeto,
    topReasons: entry.topReasons,
    actionSummary: entry.actionPlan,
    dataSourceIssues: data.dataSourceIssues ?? data.sourceErrors ?? [],
    ...(options.test ? { test: true } : {}),
  };
}
