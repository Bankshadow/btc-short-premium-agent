import { filterProductionEntries } from "@/lib/journal/production-filter";
import { loadServerAnalysisJournal } from "@/lib/journal/journal-server-store";
import { loadServerBinanceTestnetJournal } from "@/lib/exchange/binance/binance-testnet-journal-server";
import { loadLearningRecordsServer } from "@/lib/testnet-monitor/learning-records-server";
import { loadMonitorJournalEvents } from "@/lib/testnet-monitor/monitor-journal-server";
import { loadTradeQualityStore } from "@/lib/trade-quality-score/quality-store";
import { buildClosedTradesFromJournal } from "@/lib/testnet-monitor/build-testnet-monitor-snapshot";
import { buildEvidenceQualitySnapshot } from "./build-evidence-quality";
import type { EvidenceQualitySnapshot } from "./types";

export async function buildEvidenceQualityServerSnapshot(): Promise<EvidenceQualitySnapshot> {
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

  return buildEvidenceQualitySnapshot({
    journal,
    closedTrades,
    learningRecords,
    decisions,
    tradeQualityScores: qualityStore.scores ?? [],
    monitorEvents,
  });
}
