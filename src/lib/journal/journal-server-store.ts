import {
  buildDecisionLogEntry,
  deriveAnalyzeRunId,
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
    const filePath = getJournalFilePath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(next, null, 2), "utf8");
    return { entry: updated, status: "updated" };
  }

  const entry = buildDecisionLogEntry(data, { runId });
  await appendServerAnalysisJournalEntry(entry);
  return { entry, status: "created" };
}
