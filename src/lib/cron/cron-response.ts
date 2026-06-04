import { agentRecToTrade } from "@/lib/agents/types";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import {
  buildAnalysisJournalEntry,
  type AnalysisJournalEntry,
} from "@/lib/journal/analysis-journal";
import {
  resolveConfidenceLevel,
  type ConfidenceLevel,
} from "@/lib/decision/verdict-display";

export interface CronAnalyzeResponse {
  timestamp: string;
  verdict: ReturnType<typeof agentRecToTrade>;
  committeeVerdict: AnalysisJournalEntry["committeeVerdict"];
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  btcPrice: number;
  regime: string;
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
  const entry = buildAnalysisJournalEntry(data);
  const desk = data.tradingDesk;
  const tradeVerdict = agentRecToTrade(entry.committeeVerdict);
  const confidence =
    desk?.committeeVerdict.confidence ?? data.step5_verdict.confidence;

  return {
    timestamp: entry.timestamp,
    verdict: tradeVerdict,
    committeeVerdict: entry.committeeVerdict,
    confidence,
    confidenceLevel: resolveConfidenceLevel(confidence, tradeVerdict),
    btcPrice: entry.btcPrice,
    regime: entry.regime,
    riskVeto: entry.riskVeto,
    topReasons: entry.topReasons,
    actionSummary: entry.actionSummary,
    dataSourceIssues: data.dataSourceIssues ?? data.sourceErrors ?? [],
    ...(options.test ? { test: true } : {}),
  };
}
