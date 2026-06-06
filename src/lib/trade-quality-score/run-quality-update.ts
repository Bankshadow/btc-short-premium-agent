import { loadServerAnalysisJournal } from "@/lib/journal/journal-server-store";
import { filterProductionEntries } from "@/lib/journal/production-filter";
import { loadServerEvaluationResults } from "@/lib/self-learning/evaluation-server-store";
import { evaluateClosedTrade } from "@/lib/self-learning/evaluate-entry";
import { buildTradeQualitySummary } from "./build-summary";
import { buildTradeQualityScore } from "./score-trade";
import { loadTradeQualityStore, upsertTradeQualityScore } from "./quality-store";
import { TRADE_QUALITY_SAFETY_NOTICE } from "./types";
import type { TradeQualityScore, TradeQualityStatus } from "./types";

export async function getTradeQualityStatus(
  workspaceId = "server-default",
): Promise<TradeQualityStatus> {
  const store = await loadTradeQualityStore(workspaceId);
  return {
    workspaceId,
    summary: buildTradeQualitySummary(store.scores),
    lastUpdatedAt: store.lastUpdatedAt,
    safetyNotice: TRADE_QUALITY_SAFETY_NOTICE,
  };
}

export async function runTradeQualityUpdate(
  workspaceId = "server-default",
): Promise<{
  ok: boolean;
  scored: number;
  summary: ReturnType<typeof buildTradeQualitySummary>;
  safetyNotice: typeof TRADE_QUALITY_SAFETY_NOTICE;
}> {
  const [evaluations, entriesRaw] = await Promise.all([
    loadServerEvaluationResults(),
    loadServerAnalysisJournal().catch(() => []),
  ]);
  const entries = filterProductionEntries(entriesRaw);
  const evalMap = new Map(evaluations.map((e) => [e.decisionLogId, e]));

  let scored = 0;
  for (const entry of entries.filter((e) => e.outcomeStatus === "RESOLVED")) {
    const evaluation =
      evalMap.get(entry.id) ??
      evaluateClosedTrade({ entry, source: "manual_resolve" });
    const score = buildTradeQualityScore({
      entry,
      evaluation,
      source: evaluation?.source ?? "resolved_trade",
      pnlPct: evaluation?.pnlPct,
      tradeWouldWin: evaluation?.tradeWouldWin,
    });
    await upsertTradeQualityScore(score, workspaceId);
    scored += 1;
  }

  const store = await loadTradeQualityStore(workspaceId);
  return {
    ok: true,
    scored,
    summary: buildTradeQualitySummary(store.scores),
    safetyNotice: TRADE_QUALITY_SAFETY_NOTICE,
  };
}

export function getRecentTradeQualityAvg(
  scores: TradeQualityScore[],
  limit = 10,
): number | null {
  const recent = scores.slice(0, limit);
  if (recent.length === 0) return null;
  return Math.round(
    recent.reduce((sum, s) => sum + s.compositeScore, 0) / recent.length,
  );
}
