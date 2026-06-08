/** Whether automation / journal JSON is stored outside the ephemeral serverless filesystem. */
export function isJournalPersistenceConfigured(): boolean {
  return Boolean(process.env.JOURNAL_DATA_DIR?.trim());
}

/** Warn when Vercel cold starts will reset learning, rotation, and automation state. */
export function resolveJournalPersistenceWarning(): string | null {
  if (isJournalPersistenceConfigured()) return null;
  if (process.env.VERCEL === "1" || process.env.VERCEL_ENV) {
    return (
      "JOURNAL_DATA_DIR is not set — automation state (learning, rotation, cron history) " +
      "resets on serverless cold starts. Point it to Vercel Blob mount or external storage."
    );
  }
  return null;
}
