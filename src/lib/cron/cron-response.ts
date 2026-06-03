import type { AnalyzeApiResponse } from "@/lib/types/market";
import {
  buildAnalysisJournalEntry,
  type AnalysisJournalEntry,
} from "@/lib/journal/analysis-journal";

export interface CronAnalyzeResponse {
  timestamp: string;
  verdict: AnalysisJournalEntry["verdict"];
  confidence: number;
  confidenceLevel: AnalysisJournalEntry["confidenceLevel"];
  btcPrice: number;
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

  return {
    timestamp: entry.timestamp,
    verdict: entry.verdict,
    confidence: entry.confidence,
    confidenceLevel: entry.confidenceLevel,
    btcPrice: entry.btcPrice,
    topReasons: entry.topReasons,
    actionSummary: entry.actionSummary,
    dataSourceIssues: data.dataSourceIssues ?? data.sourceErrors ?? [],
    ...(options.test ? { test: true } : {}),
  };
}
