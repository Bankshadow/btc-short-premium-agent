import { isCronSecretConfigured, isTestAutomationAllowed } from "@/lib/cron/cron-auth";
import { probeJournalWritable } from "@/lib/cron/ensure-journal-dir";
import { isJournalPersistenceConfigured } from "@/lib/cron/journal-persistence";
import { isBlobJournalEnabled } from "@/lib/cron/journal-storage";
import {
  isTestnetPrimaryAutomation,
  resolveAutomationPrimaryMode,
  TESTNET_PRIMARY_AUTOMATION_JOBS,
} from "./primary-mode";
import { normalizeCronIntervalMinutes, msUntilNextAutomationRun, resolveLastAutomationRunAt } from "./cron-config";
import { loadAutomationState } from "./state-store";

export interface CronHealthSnapshot {
  cronSecretConfigured: boolean;
  testAutomationAllowed: boolean;
  automationEnabled: boolean;
  paused: boolean;
  intervalMinutes: number;
  lastRunAt: string | null;
  nextDueInMs: number;
  primaryMode: string;
  spineJobs: string[];
  journalPersistenceConfigured: boolean;
  journalWritable: boolean;
  journalPath: string;
  journalError: string | null;
  githubCronNote: string;
  vercelCronNote: string;
  ready: boolean;
  issues: string[];
}

export async function buildCronHealthSnapshot(
  workspaceId = "server-default",
): Promise<CronHealthSnapshot> {
  const state = await loadAutomationState(workspaceId);
  const journalProbe = await probeJournalWritable();
  const issues: string[] = [];

  if (!isCronSecretConfigured()) {
    issues.push("CRON_SECRET not set — GitHub Actions / manual tick will fail.");
  }
  if (!state.settings.automationEnabled) {
    issues.push("Automation disabled in settings.");
  }
  if (state.settings.paused) {
    issues.push("Automation paused.");
  }
  if (!journalProbe.ok) {
    issues.push(journalProbe.error ?? "Journal directory not writable.");
  } else if (isBlobJournalEnabled()) {
    // Durable blob storage — no warning.
  } else if (journalProbe.usingFallback) {
    issues.push(
      `JOURNAL_DATA_DIR (${process.env.JOURNAL_DATA_DIR}) not writable — using fallback ${journalProbe.path}. Connect Vercel Blob for durable journal storage.`,
    );
  } else if (!isJournalPersistenceConfigured() && process.env.VERCEL) {
    issues.push(
      "Journal persistence unset on Vercel — connect a Blob store (Storage tab) for durable automation state.",
    );
  }

  const lastRunAt = resolveLastAutomationRunAt(state);
  if (!lastRunAt) {
    issues.push("No automation cycle recorded yet — run /api/cron/tick?force=1.");
  }

  return {
    cronSecretConfigured: isCronSecretConfigured(),
    testAutomationAllowed: isTestAutomationAllowed(),
    automationEnabled: state.settings.automationEnabled,
    paused: state.settings.paused,
    intervalMinutes: normalizeCronIntervalMinutes(state.settings.intervalMinutes),
    lastRunAt,
    nextDueInMs: msUntilNextAutomationRun(state),
    primaryMode: resolveAutomationPrimaryMode(),
    spineJobs: isTestnetPrimaryAutomation() ? [...TESTNET_PRIMARY_AUTOMATION_JOBS] : [],
    journalPersistenceConfigured: isJournalPersistenceConfigured(),
    journalWritable: journalProbe.ok,
    journalPath: journalProbe.path,
    journalError: journalProbe.error ?? null,
    githubCronNote:
      "GitHub Actions workflow automation-cron.yml calls /api/cron/tick every 5m (requires repo secret CRON_SECRET).",
    vercelCronNote: "Vercel cron also calls /api/cron/tick every 15m when deployed.",
    ready:
      isCronSecretConfigured() &&
      state.settings.automationEnabled &&
      !state.settings.paused &&
      journalProbe.ok,
    issues,
  };
}
