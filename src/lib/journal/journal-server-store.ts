import {
  buildDecisionLogEntry,
  deriveAnalyzeRunId,
  DECISION_LOG_MAX_ENTRIES,
  type DecisionLogEntry,
} from "@/lib/journal/decision-log";
import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import type { AnalyzeApiResponse } from "@/lib/types/market";

const JOURNAL_FILENAME = "analysis-journal.json";

export async function loadServerAnalysisJournal(): Promise<DecisionLogEntry[]> {
  const parsed = await readCronJsonFile(JOURNAL_FILENAME, [] as DecisionLogEntry[]);
  return Array.isArray(parsed) ? parsed : [];
}

export async function appendServerAnalysisJournalEntry(
  entry: DecisionLogEntry,
): Promise<DecisionLogEntry[]> {
  const next = [entry, ...(await loadServerAnalysisJournal())].slice(
    0,
    DECISION_LOG_MAX_ENTRIES,
  );
  await writeCronJsonFile(JOURNAL_FILENAME, next);
  return next;
}

export async function appendServerAnalysisFromResponse(
  data: AnalyzeApiResponse,
): Promise<{ entry: DecisionLogEntry; status: "created" | "updated" }> {
  const runId = deriveAnalyzeRunId(data);
  const journal = await loadServerAnalysisJournal();
  const existing = journal.find((e) => e.runId === runId);

  if (existing) {
    const updated: DecisionLogEntry = {
      ...buildDecisionLogEntry(data, { runId }),
      id: existing.id,
      outcomeStatus: existing.outcomeStatus,
      resolution: existing.resolution,
      paperPnl: existing.paperPnl,
      reflection: existing.reflection,
    };
    const next = journal.map((e) => (e.id === existing.id ? updated : e));
    await writeCronJsonFile(JOURNAL_FILENAME, next);
    return { entry: updated, status: "updated" };
  }

  const entry = buildDecisionLogEntry(data, { runId });
  await appendServerAnalysisJournalEntry(entry);
  return { entry, status: "created" };
}
