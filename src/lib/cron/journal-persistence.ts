import { isBlobJournalEnabled } from "./journal-storage";

/** Whether automation / journal JSON is stored outside the ephemeral serverless filesystem. */
export function isJournalPersistenceConfigured(): boolean {
  return isBlobJournalEnabled() || Boolean(process.env.JOURNAL_DATA_DIR?.trim());
}

/** Warn when Vercel cold starts will reset learning, rotation, and automation state. */
export function resolveJournalPersistenceWarning(): string | null {
  if (isJournalPersistenceConfigured()) return null;
  if (process.env.VERCEL === "1" || process.env.VERCEL_ENV) {
    return (
      "Journal persistence not configured — connect Vercel Blob or set JOURNAL_DATA_DIR. " +
      "Automation state resets on serverless cold starts."
    );
  }
  return null;
}
