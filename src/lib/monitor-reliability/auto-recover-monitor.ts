import type { AnomalyFinding } from "@/lib/anomaly-detection/types";
import { upsertAnomalyFindings } from "@/lib/anomaly-detection/store";
import type { BinanceOrderPreview, BinancePosition, BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import { backfillOrphanBinanceJournalEntries } from "@/lib/exchange/binance/binance-journal-backfill";
import { persistReconciledBinanceJournal } from "@/lib/exchange/binance/binance-journal-reconcile";
import { reconcileBinancePositions } from "@/lib/exchange/binance/binance-position-monitor";
import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import type { MonitorIssue } from "./types";

const PREVIEW_CACHE_FILE = "binance-preview-cache.json";

async function loadPreviewCache(): Promise<Record<string, BinanceOrderPreview>> {
  const parsed = await readCronJsonFile<Record<string, BinanceOrderPreview>>(
    PREVIEW_CACHE_FILE,
    {},
  );
  return parsed && typeof parsed === "object" ? parsed : {};
}

export async function pruneExpiredPreviewsFromCache(): Promise<number> {
  const cache = await loadPreviewCache();
  const now = Date.now();
  const pruned = Object.fromEntries(
    Object.entries(cache).filter(([, p]) => now <= Date.parse(p.expiresAt)),
  );
  const removed = Object.keys(cache).length - Object.keys(pruned).length;
  if (removed > 0) {
    await writeCronJsonFile(PREVIEW_CACHE_FILE, pruned);
  }
  return removed;
}

function markOrphanJournalEntries(
  journal: BinanceTestnetJournalEntry[],
): BinanceTestnetJournalEntry[] {
  const seenClosing = new Set<string>();
  return journal.map((entry) => {
    if (entry.status === "CLOSING") {
      if (seenClosing.has(entry.symbol)) {
        return {
          ...entry,
          closeFailed: true,
          operatorNote: `${entry.operatorNote ?? ""} · duplicate close marked orphan`.trim(),
        };
      }
      seenClosing.add(entry.symbol);
    }
    if (
      entry.source === "manual_test" &&
      entry.reason?.includes("Backfilled") &&
      !entry.decisionLogId
    ) {
      return {
        ...entry,
        operatorNote: entry.operatorNote ?? "Orphan exchange position — backfilled for reconcile.",
      };
    }
    return entry;
  });
}

function buildReconcileIncidents(
  mismatches: string[],
): AnomalyFinding[] {
  if (mismatches.length === 0) return [];
  return [
    {
      anomalyType: "monitor_reliability_degraded",
      severity: "CRITICAL",
      title: "Testnet monitor cannot reconcile position state",
      evidence: { mismatches },
      impactedModules: ["Testnet Monitor", "Binance Autoexec"],
      recommendedAction:
        "Review journal vs exchange positions; resolve before new testnet entries.",
      fingerprint: `monitor-reconcile:${mismatches.join("|")}`.slice(0, 240),
    },
  ];
}

export async function runMonitorAutoRecovery(input: {
  journal: BinanceTestnetJournalEntry[];
  positions: BinancePosition[];
}): Promise<{
  journal: BinanceTestnetJournalEntry[];
  recovered: string[];
  recoveryAction: string;
  incidentsCreated: number;
}> {
  const recovered: string[] = [];
  let journal = input.journal;

  const backfill = backfillOrphanBinanceJournalEntries({
    positions: input.positions,
    journal,
  });
  if (backfill.backfilledSymbols.length > 0) {
    journal = backfill.journal;
    recovered.push(`Backfilled journal: ${backfill.backfilledSymbols.join(", ")}`);
  }

  journal = markOrphanJournalEntries(journal);
  journal = await persistReconciledBinanceJournal({
    journal,
    positions: input.positions,
  });
  recovered.push("Reconciled journal with exchange positions");

  const pruned = await pruneExpiredPreviewsFromCache();
  if (pruned > 0) {
    recovered.push(`Pruned ${pruned} expired preview(s) from cache`);
  }

  const reconcile = reconcileBinancePositions({
    positions: input.positions,
    journal,
  });

  let incidentsCreated = 0;
  if (!reconcile.healthy) {
    const findings = buildReconcileIncidents(reconcile.mismatches);
    if (findings.length > 0) {
      await upsertAnomalyFindings(findings);
      incidentsCreated = findings.length;
    }
  }

  const recoveryAction =
    recovered.length > 0
      ? recovered.join(" · ")
      : reconcile.healthy
        ? "No recovery needed — monitor state aligned."
        : "Recovery attempted — position state still uncertain.";

  return { journal, recovered, recoveryAction, incidentsCreated };
}

export function markIssuesRecovered(
  issues: MonitorIssue[],
  recoveredActions: string[],
): MonitorIssue[] {
  if (recoveredActions.length === 0) return issues;
  return issues.map((item) => {
    if (
      item.kind === "exchange_closed_not_journaled" &&
      recoveredActions.some((a) => a.includes("Reconciled"))
    ) {
      return { ...item, recovered: true };
    }
    if (
      item.kind === "expired_preview_executable" &&
      recoveredActions.some((a) => a.includes("Pruned"))
    ) {
      return { ...item, recovered: true };
    }
    if (
      item.kind === "position_state_uncertain" &&
      recoveredActions.some((a) => a.includes("Backfilled"))
    ) {
      return { ...item, recovered: true };
    }
    return item;
  });
}
