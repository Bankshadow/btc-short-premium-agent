import { agentRecToTrade } from "@/lib/agents/types";
import { buildAnalysisJournalEntry } from "@/lib/journal/analysis-journal";
import { resolveConfidenceLevel } from "@/lib/decision/verdict-display";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import {
  getSupabaseAdmin,
  isSupabaseConfigured,
  SupabaseConfigError,
} from "./client";

export interface AnalysisRunRow {
  id: string;
  created_at: string;
  btc_price: number | null;
  verdict: string;
  confidence: string;
  top_reasons: string[];
  action_summary: string | null;
  liquidation24h: number | null;
  iv_hv_ratio: number | null;
  sd_distance: number | null;
  delta: number | null;
  raw_result: AnalyzeApiResponse;
}

export class SupabaseJournalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseJournalError";
  }
}

function buildAnalysisRunInsert(data: AnalyzeApiResponse) {
  const entry = buildAnalysisJournalEntry(data);
  const market = data.step1_marketSnapshot;
  const candidate = data.step5_verdict.candidate;
  const tradeVerdict = agentRecToTrade(entry.committeeVerdict);
  const confidence =
    data.tradingDesk?.committeeVerdict.confidence ??
    data.step5_verdict.confidence;

  return {
    btc_price: entry.btcPrice > 0 ? entry.btcPrice : null,
    verdict: tradeVerdict,
    confidence: resolveConfidenceLevel(confidence, tradeVerdict),
    top_reasons: entry.topReasons,
    action_summary: entry.actionSummary,
    liquidation24h: data.liquidation.liquidation24h,
    iv_hv_ratio: market.ivHvRatio > 0 ? market.ivHvRatio : null,
    sd_distance: candidate?.sdDistance ?? null,
    delta: candidate?.delta ?? null,
    raw_result: data,
  };
}

/**
 * Persists a cron analysis result to Supabase `analysis_runs`.
 * Analysis-only — no order data is written.
 */
export async function saveAnalysisRunToSupabase(
  data: AnalyzeApiResponse,
): Promise<{ id: string; createdAt: string }> {
  if (!isSupabaseConfigured()) {
    throw new SupabaseConfigError(
      "Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
    );
  }

  const supabase = getSupabaseAdmin();
  const row = buildAnalysisRunInsert(data);

  const { data: inserted, error } = await supabase
    .from("analysis_runs")
    .insert(row)
    .select("id, created_at")
    .single();

  if (error) {
    throw new SupabaseJournalError(error.message);
  }

  if (!inserted?.id) {
    throw new SupabaseJournalError("Supabase insert returned no row id.");
  }

  return {
    id: inserted.id as string,
    createdAt: inserted.created_at as string,
  };
}

export { isSupabaseConfigured };
