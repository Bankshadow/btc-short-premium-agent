import { validateEventBatch } from "../event-validator";
import type { JournalEvent } from "@/lib/journal/journal-types";
import type { CoreValidationIssue } from "../core-errors";

export function runAuditValidation(events: JournalEvent[]): CoreValidationIssue[] {
  return validateEventBatch(events, { checkLifecycle: true });
}

export async function buildAuditValidationSummary(events: JournalEvent[]) {
  const issues = runAuditValidation(events);
  return {
    ok: issues.filter((i) => i.severity === "ERROR").length === 0,
    issueCount: issues.length,
    blockCount: issues.filter((i) => i.severity === "ERROR").length,
    warningCount: issues.filter((i) => i.severity === "WARNING").length,
    issues,
  };
}
