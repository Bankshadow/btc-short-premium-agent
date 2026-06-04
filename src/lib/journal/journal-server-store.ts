import {
  buildDecisionLogEntry,
  DECISION_LOG_MAX_ENTRIES,
  type DecisionLogEntry,
} from "@/lib/journal/decision-log";
import { getCronDataDir } from "@/lib/cron/cron-config";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import fs from "fs/promises";
import path from "path";

const JOURNAL_FILENAME = "analysis-journal.json";

function getJournalFilePath(): string {
  return path.join(getCronDataDir(), JOURNAL_FILENAME);
}

export async function loadServerAnalysisJournal(): Promise<DecisionLogEntry[]> {
  try {
    const raw = await fs.readFile(getJournalFilePath(), "utf8");
    const parsed = JSON.parse(raw) as DecisionLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function appendServerAnalysisJournalEntry(
  entry: DecisionLogEntry,
): Promise<DecisionLogEntry[]> {
  const filePath = getJournalFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const next = [entry, ...(await loadServerAnalysisJournal())].slice(
    0,
    DECISION_LOG_MAX_ENTRIES,
  );
  await fs.writeFile(filePath, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function appendServerAnalysisFromResponse(
  data: AnalyzeApiResponse,
): Promise<DecisionLogEntry> {
  const entry = buildDecisionLogEntry(data);
  await appendServerAnalysisJournalEntry(entry);
  return entry;
}
