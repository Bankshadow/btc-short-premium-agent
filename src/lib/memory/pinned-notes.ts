export const PINNED_NOTES_STORAGE_KEY =
  "trading-agents-crypto-desk:pinned-memory-notes";

const MAX_PINNED = 10;

export function loadPinnedNotes(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PINNED_NOTES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

export function savePinnedNotes(notes: string[]): string[] {
  if (typeof window === "undefined") return notes;
  const next = notes.slice(0, MAX_PINNED);
  localStorage.setItem(PINNED_NOTES_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function addPinnedNote(note: string): string[] {
  const trimmed = note.trim();
  if (!trimmed) return loadPinnedNotes();
  return savePinnedNotes([trimmed, ...loadPinnedNotes()]);
}

export function removePinnedNote(index: number): string[] {
  const notes = loadPinnedNotes();
  return savePinnedNotes(notes.filter((_, i) => i !== index));
}

export function clearPinnedNotes(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PINNED_NOTES_STORAGE_KEY);
}
