import fs from "node:fs";
import path from "node:path";
import type { JournalEvent } from "./journal-types";

const BLOB_PATHNAME = process.env.JOURNAL_BLOB_PATHNAME?.trim() || "v2-core/event-journal.json";

function ensureDir(dir: string): string {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function fileJournalDir(): string {
  if (process.env.VERCEL) {
    return ensureDir(path.join("/tmp", "v2-journal"));
  }
  const custom = process.env.JOURNAL_DATA_DIR?.trim();
  if (custom) {
    try {
      return ensureDir(custom);
    } catch {
      return ensureDir(path.join("/tmp", "v2-journal"));
    }
  }
  return ensureDir(path.join(process.cwd(), "data"));
}

function fileJournalPath(): string {
  return path.join(fileJournalDir(), "event-journal.json");
}

function parseEvents(raw: string): JournalEvent[] {
  try {
    const parsed = JSON.parse(raw) as JournalEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isBlobJournalEnabled(): boolean {
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) return true;
  // Linked Vercel Blob stores use OIDC + BLOB_STORE_ID at runtime (no RW token in env).
  if (process.env.VERCEL && process.env.BLOB_STORE_ID?.trim()) return true;
  return false;
}

async function readFromBlob(): Promise<JournalEvent[]> {
  const { get } = await import("@vercel/blob");
  try {
    const result = await get(BLOB_PATHNAME, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return [];
    const text = await new Response(result.stream).text();
    return parseEvents(text);
  } catch {
    return [];
  }
}

async function writeToBlob(events: JournalEvent[]): Promise<void> {
  const { put } = await import("@vercel/blob");
  await put(BLOB_PATHNAME, JSON.stringify(events, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

function readFromFile(): JournalEvent[] {
  const file = fileJournalPath();
  if (!fs.existsSync(file)) return [];
  return parseEvents(fs.readFileSync(file, "utf8"));
}

function writeToFile(events: JournalEvent[]): void {
  const file = fileJournalPath();
  fs.writeFileSync(file, JSON.stringify(events, null, 2), "utf8");
}

export type JournalBackend = "blob" | "file";

export function resolveJournalBackend(): JournalBackend {
  return isBlobJournalEnabled() ? "blob" : "file";
}

export async function readJournalEvents(): Promise<JournalEvent[]> {
  if (isBlobJournalEnabled()) {
    return readFromBlob();
  }
  return readFromFile();
}

export async function writeJournalEvents(events: JournalEvent[]): Promise<void> {
  if (isBlobJournalEnabled()) {
    await writeToBlob(events);
    return;
  }
  writeToFile(events);
}

/** Sync read for file backend only (tests/local). */
export function readJournalEventsSync(): JournalEvent[] {
  if (isBlobJournalEnabled()) return [];
  return readFromFile();
}
