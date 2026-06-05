import type { OptionsOrderPreview, OptionsPreviewJournalEntry } from "./types";

export const OPTIONS_PREVIEW_JOURNAL_KEY = "btc-desk:options-preview-journal";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadOptionsPreviewJournal(): OptionsPreviewJournalEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(OPTIONS_PREVIEW_JOURNAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as OptionsPreviewJournalEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveOptionsPreviewJournal(
  entries: OptionsPreviewJournalEntry[],
): void {
  if (!isBrowser()) return;
  localStorage.setItem(OPTIONS_PREVIEW_JOURNAL_KEY, JSON.stringify(entries.slice(0, 150)));
}

export function appendOptionsPreviewJournal(
  entry: OptionsPreviewJournalEntry,
): OptionsPreviewJournalEntry[] {
  const next = [entry, ...loadOptionsPreviewJournal()];
  saveOptionsPreviewJournal(next);
  return next;
}

export function journalEntryFromPreview(
  preview: OptionsOrderPreview,
  options: {
    paperOrderLinked: boolean;
    paperOrderId: string | null;
    operatorNote?: string;
    status?: OptionsPreviewJournalEntry["status"];
  },
): OptionsPreviewJournalEntry {
  return {
    id: `opt-j-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    previewId: preview.previewId,
    decisionLogId: preview.ticket?.decisionLogId ?? "",
    symbol: preview.ticket?.optionsInstrument.symbol ?? "",
    instrument: preview.ticket?.instrument ?? "no_trade",
    status: options.status ?? (preview.valid ? "PREVIEWED" : "REJECTED"),
    valid: preview.valid,
    estimatedPremiumUsd: preview.estimatedPremiumUsd,
    blockingReasons: preview.blockingReasons,
    paperOrderLinked: options.paperOrderLinked,
    paperOrderId: options.paperOrderId,
    createdAt: new Date().toISOString(),
    operatorNote: options.operatorNote ?? null,
  };
}
