import type {
  AnalyzeApiResponse,
  OptionCandidate,
  TradeRecommendation,
} from "@/lib/types/market";
import {
  collectTopReasons,
  resolveActionSummary,
  resolveConfidenceLevel,
  type ConfidenceLevel,
} from "@/lib/decision/verdict-display";

export const ANALYSIS_JOURNAL_STORAGE_KEY =
  "btc-short-premium-agent:analysis-journal";

export const JOURNAL_MAX_ENTRIES = 10;

export interface JournalOptionCandidate {
  symbol: string;
  strike: number;
  expiry: string;
  delta: number;
  sdDistance: number;
}

export interface AnalysisJournalEntry {
  id: string;
  timestamp: string;
  btcPrice: number;
  verdict: TradeRecommendation;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  topReasons: string[];
  callCandidate: JournalOptionCandidate | null;
  putCandidate: JournalOptionCandidate | null;
  liquidation24h: number | null;
  ivHvRatio: number;
  sdDistance: number | null;
  delta: number | null;
  actionSummary: string;
}

function pickBestByType(
  candidates: OptionCandidate[],
  optionType: "call" | "put",
): JournalOptionCandidate | null {
  const filtered = candidates.filter((c) => c.optionType === optionType);
  if (filtered.length === 0) return null;

  const best = [...filtered].sort(
    (a, b) =>
      Math.abs(Math.abs(a.delta) - 0.14) - Math.abs(Math.abs(b.delta) - 0.14),
  )[0];

  return {
    symbol: best.symbol,
    strike: best.strike,
    expiry: best.expiry,
    delta: best.delta,
    sdDistance: best.sdDistance,
  };
}

function toJournalCandidate(
  candidate: OptionCandidate | undefined,
): JournalOptionCandidate | null {
  if (!candidate) return null;
  return {
    symbol: candidate.symbol,
    strike: candidate.strike,
    expiry: candidate.expiry,
    delta: candidate.delta,
    sdDistance: candidate.sdDistance,
  };
}

export function buildAnalysisJournalEntry(
  data: AnalyzeApiResponse,
): AnalysisJournalEntry {
  const market = data.step1_marketSnapshot;
  const verdict = data.step5_verdict;
  const actionPlan = data.step6_actionPlan;
  const selected = verdict.candidate;

  const topReasons = collectTopReasons(
    verdict,
    data.step2_eightCheckFramework,
    data.step3_noTradeRules,
    data.step4_combinationRead,
  );

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: verdict.analyzedAt,
    btcPrice: market.spotPrice,
    verdict: verdict.recommendation,
    confidence: verdict.confidence,
    confidenceLevel: resolveConfidenceLevel(
      verdict.confidence,
      verdict.recommendation,
    ),
    topReasons,
    callCandidate:
      pickBestByType(data.optionCandidates, "call") ??
      (selected?.optionType === "call" ? toJournalCandidate(selected) : null),
    putCandidate:
      pickBestByType(data.optionCandidates, "put") ??
      (selected?.optionType === "put" ? toJournalCandidate(selected) : null),
    liquidation24h: data.liquidation.liquidation24h,
    ivHvRatio: market.ivHvRatio,
    sdDistance: selected?.sdDistance ?? null,
    delta: selected?.delta ?? null,
    actionSummary: resolveActionSummary(verdict, actionPlan),
  };
}

export function loadAnalysisJournal(): AnalysisJournalEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(ANALYSIS_JOURNAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AnalysisJournalEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAnalysisJournalEntry(
  entry: AnalysisJournalEntry,
): AnalysisJournalEntry[] {
  if (typeof window === "undefined") return [];

  const next = [entry, ...loadAnalysisJournal()].slice(0, JOURNAL_MAX_ENTRIES);
  localStorage.setItem(ANALYSIS_JOURNAL_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function appendAnalysisFromResponse(
  data: AnalyzeApiResponse,
): AnalysisJournalEntry[] {
  return saveAnalysisJournalEntry(buildAnalysisJournalEntry(data));
}
