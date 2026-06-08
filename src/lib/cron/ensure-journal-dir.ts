import fs from "fs/promises";
import path from "path";

const PROBE_FILE = ".journal-write-probe";

let activeJournalDir: string | null = null;

function defaultJournalCandidates(): string[] {
  const configured = process.env.JOURNAL_DATA_DIR?.trim();
  const candidates = [
    configured,
    process.env.VERCEL ? "/tmp/btc-desk-journal" : null,
    path.join(/* turbopackIgnore: true */ process.cwd(), "data"),
  ].filter(Boolean) as string[];
  return [...new Set(candidates)];
}

export function getActiveJournalDataDir(): string {
  if (activeJournalDir) return activeJournalDir;
  const [first] = defaultJournalCandidates();
  return first ?? path.join(/* turbopackIgnore: true */ process.cwd(), "data");
}

export async function ensureJournalDataDir(): Promise<string> {
  if (activeJournalDir) return activeJournalDir;

  let lastError: string | undefined;
  for (const dir of defaultJournalCandidates()) {
    try {
      await fs.mkdir(dir, { recursive: true });
      const probePath = path.join(dir, PROBE_FILE);
      await fs.writeFile(probePath, new Date().toISOString(), "utf8");
      await fs.unlink(probePath).catch(() => undefined);
      activeJournalDir = dir;
      return dir;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Journal dir not writable";
    }
  }

  throw new Error(lastError ?? "No writable journal directory");
}

export async function probeJournalWritable(): Promise<{
  ok: boolean;
  path: string;
  error?: string;
  usingFallback: boolean;
}> {
  try {
    const dir = await ensureJournalDataDir();
    const configured = process.env.JOURNAL_DATA_DIR?.trim();
    return {
      ok: true,
      path: dir,
      usingFallback: Boolean(configured && configured !== dir),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Journal dir not writable";
    return {
      ok: false,
      path: getActiveJournalDataDir(),
      error: message,
      usingFallback: false,
    };
  }
}
