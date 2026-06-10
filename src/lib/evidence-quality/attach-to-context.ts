import type { AnalysisContext } from "@/lib/analysis-engine/analysis-state";
import { filterProductionEntries } from "@/lib/journal/production-filter";
import { loadServerAnalysisJournal } from "@/lib/journal/journal-server-store";
import { loadServerBinanceTestnetJournal } from "@/lib/exchange/binance/binance-testnet-journal-server";
import { loadLearningRecordsServer } from "@/lib/testnet-monitor/learning-records-server";
import { loadMonitorJournalEvents } from "@/lib/testnet-monitor/monitor-journal-server";
import { loadTradeQualityStore } from "@/lib/trade-quality-score/quality-store";
import { buildClosedTradesFromJournal } from "@/lib/testnet-monitor/build-testnet-monitor-snapshot";
import {
  buildEvidenceQualitySnapshot,
  toAnalysisContextEvidenceQualityLink,
} from "./build-evidence-quality";

export async function attachEvidenceQualityToContext(
  context: AnalysisContext,
): Promise<AnalysisContext> {
  const [journal, entriesRaw, learningRecords, monitorEvents, qualityStore] =
    await Promise.all([
      loadServerBinanceTestnetJournal().catch(() => []),
      loadServerAnalysisJournal().catch(() => []),
      loadLearningRecordsServer().catch(() => []),
      loadMonitorJournalEvents().catch(() => []),
      loadTradeQualityStore().catch(() => ({ scores: [] })),
    ]);

  const decisions = filterProductionEntries(entriesRaw);
  const closedTrades = buildClosedTradesFromJournal(journal);

  const snapshot = buildEvidenceQualitySnapshot({
    journal,
    closedTrades,
    learningRecords,
    decisions,
    tradeQualityScores: qualityStore.scores ?? [],
    monitorEvents,
  });

  return {
    ...context,
    evidenceQuality: toAnalysisContextEvidenceQualityLink(snapshot),
  };
}
