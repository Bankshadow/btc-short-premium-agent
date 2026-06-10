import { getPositions } from "@/lib/exchange/binance/binance-futures-testnet";
import {
  loadServerBinanceTestnetJournal,
  saveServerBinanceTestnetJournal,
} from "@/lib/exchange/binance/binance-testnet-journal-server";
import { backfillOrphanBinanceJournalEntries } from "@/lib/exchange/binance/binance-journal-backfill";
import { reconcileBinanceJournalStatuses } from "@/lib/exchange/binance/binance-journal-reconcile";
import { loadServerAnalysisJournal } from "@/lib/journal/journal-server-store";
import { invalidateMissionSnapshotCache } from "@/lib/mission-flow/build-server-snapshot";
import { buildClosedTradesFromJournal } from "@/lib/testnet-monitor/build-testnet-monitor-snapshot";
import { syncLearningRecordsFromClosedTradesServer } from "@/lib/testnet-monitor/learning-records-server";
import { loadMonitorJournalEvents } from "@/lib/testnet-monitor/monitor-journal-server";
import {
  backfillMissingDecisionLogIds,
  backfillMissingMonitorEvents,
} from "./backfill-engine-consistency-links";
import type { ConsistencyAutoFixId } from "./types";

export interface ApplyConsistencyAutoFixResult {
  ok: boolean;
  applied: ConsistencyAutoFixId[];
  skipped: ConsistencyAutoFixId[];
  errors: string[];
  /** Safety — reconciliation never opens exchange orders. */
  tradesOpened: false;
}

/**
 * Safe auto-fixes only — journal reconcile, backfill ledger rows for existing
 * exchange positions, learning sync, mission cache refresh. Never places orders.
 */
export async function applyConsistencyAutoFix(
  actions: ConsistencyAutoFixId[],
): Promise<ApplyConsistencyAutoFixResult> {
  const applied: ConsistencyAutoFixId[] = [];
  const skipped: ConsistencyAutoFixId[] = [];
  const errors: string[] = [];
  const unique = [...new Set(actions)];

  for (const action of unique) {
    try {
      switch (action) {
        case "journal_reconcile": {
          const [journal, positions] = await Promise.all([
            loadServerBinanceTestnetJournal(),
            getPositions().catch(() => []),
          ]);
          const next = reconcileBinanceJournalStatuses(journal, positions);
          if (JSON.stringify(next) !== JSON.stringify(journal)) {
            await saveServerBinanceTestnetJournal(next);
          }
          applied.push(action);
          break;
        }
        case "journal_backfill": {
          const [journal, positions] = await Promise.all([
            loadServerBinanceTestnetJournal(),
            getPositions().catch(() => []),
          ]);
          const reconciled = reconcileBinanceJournalStatuses(journal, positions);
          const { journal: backfilled, backfilledSymbols } =
            backfillOrphanBinanceJournalEntries({
              positions,
              journal: reconciled,
            });
          if (backfilledSymbols.length > 0) {
            await saveServerBinanceTestnetJournal(backfilled);
          }
          applied.push(action);
          break;
        }
        case "decision_log_backfill": {
          const [journal, decisions] = await Promise.all([
            loadServerBinanceTestnetJournal(),
            loadServerAnalysisJournal().catch(() => []),
          ]);
          const { journal: linked, linkedCount } = backfillMissingDecisionLogIds(
            journal,
            decisions,
          );
          if (linkedCount > 0) {
            await saveServerBinanceTestnetJournal(linked);
          }
          applied.push(action);
          break;
        }
        case "monitor_event_backfill": {
          const [decisions, monitorEvents] = await Promise.all([
            loadServerAnalysisJournal().catch(() => []),
            loadMonitorJournalEvents().catch(() => []),
          ]);
          const { createdCount } = await backfillMissingMonitorEvents({
            decisions,
            monitorEvents,
          });
          if (createdCount >= 0) {
            applied.push(action);
          }
          break;
        }
        case "learning_sync": {
          const [journal, decisions] = await Promise.all([
            loadServerBinanceTestnetJournal(),
            loadServerAnalysisJournal().catch(() => []),
          ]);
          const closedTrades = buildClosedTradesFromJournal(journal);
          await syncLearningRecordsFromClosedTradesServer({
            closedTrades,
            journal,
            decisions,
          });
          applied.push(action);
          break;
        }
        case "mission_snapshot_refresh": {
          invalidateMissionSnapshotCache();
          applied.push(action);
          break;
        }
        default:
          skipped.push(action);
      }
    } catch (err) {
      errors.push(
        `${action}: ${err instanceof Error ? err.message : "Auto-fix failed"}`,
      );
      skipped.push(action);
    }
  }

  return {
    ok: errors.length === 0,
    applied,
    skipped,
    errors,
    tradesOpened: false,
  };
}
