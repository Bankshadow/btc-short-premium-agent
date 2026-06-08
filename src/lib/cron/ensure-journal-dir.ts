import fs from "fs/promises";
import path from "path";
import { getCronDataDir } from "./cron-config";

const PROBE_FILE = ".journal-write-probe";

export async function ensureJournalDataDir(): Promise<string> {
  const dir = getCronDataDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function probeJournalWritable(): Promise<{
  ok: boolean;
  path: string;
  error?: string;
}> {
  const dir = getCronDataDir();
  try {
    await fs.mkdir(dir, { recursive: true });
    const probePath = path.join(dir, PROBE_FILE);
    await fs.writeFile(probePath, new Date().toISOString(), "utf8");
    await fs.unlink(probePath).catch(() => undefined);
    return { ok: true, path: dir };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Journal dir not writable";
    return { ok: false, path: dir, error: message };
  }
}
