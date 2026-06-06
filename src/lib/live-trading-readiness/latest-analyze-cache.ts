import type { AnalyzeApiResponse } from "@/lib/types/market";

export const LATEST_ANALYZE_CACHE_KEY = "btc-desk:latest-analyze-cache";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function cacheLatestAnalyze(data: AnalyzeApiResponse): void {
  if (!isBrowser()) return;
  try {
    const slim = {
      step1_marketSnapshot: data.step1_marketSnapshot,
      step5_verdict: data.step5_verdict,
      step6_actionPlan: data.step6_actionPlan,
      tradingDesk: data.tradingDesk,
      dataTrust: data.dataTrust,
      sourceErrors: data.sourceErrors,
      riskBudget: data.riskBudget,
      conflictAnalysis: data.conflictAnalysis,
      preMortem: data.preMortem,
      learningSnapshot: data.learningSnapshot,
    };
    localStorage.setItem(
      LATEST_ANALYZE_CACHE_KEY,
      JSON.stringify({ cachedAt: new Date().toISOString(), data: slim }),
    );
  } catch {
    /* ignore quota */
  }
}

export function loadLatestAnalyzeCache(): AnalyzeApiResponse | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(LATEST_ANALYZE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data?: AnalyzeApiResponse };
    return parsed.data ?? null;
  } catch {
    return null;
  }
}
