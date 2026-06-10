import fs from "node:fs";
import path from "node:path";
import type { JournalEvent } from "./journal-types";

function ensureDir(dir: string): string {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function journalDataDir(): string {
  if (process.env.VERCEL) {
    return ensureDir(path.join(/* turbopackIgnore: true */ "/tmp", "v2-journal"));
  }

  const custom = process.env.JOURNAL_DATA_DIR?.trim();
  if (custom) {
    try {
      return ensureDir(custom);
    } catch {
      return ensureDir(path.join(/* turbopackIgnore: true */ "/tmp", "v2-journal"));
    }
  }

  return ensureDir(path.join(/* turbopackIgnore: true */ process.cwd(), "data"));
}

function journalFilePath(): string {
  return path.join(journalDataDir(), "event-journal.json");
}

export function readEventsSync(): JournalEvent[] {
  const file = journalFilePath();
  if (!fs.existsSync(file)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as JournalEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function readEvents(): Promise<JournalEvent[]> {
  return readEventsSync();
}

export async function writeEvents(events: JournalEvent[]): Promise<void> {
  const file = journalFilePath();
  fs.writeFileSync(file, JSON.stringify(events, null, 2), "utf8");
}

export async function persistAppend(event: JournalEvent): Promise<JournalEvent> {
  const events = await readEvents();
  events.push(event);
  await writeEvents(events);
  return event;
}
