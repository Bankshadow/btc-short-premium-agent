import { invalidateMissionSnapshotCache } from "@/lib/mission-flow/build-server-snapshot";
import {
  CRON_INTERVAL_PRESETS,
  describeCronSchedule,
  GITHUB_CRON_MIN_MINUTES,
  isAutomationDue,
  MAX_CRON_INTERVAL_MINUTES,
  MIN_CRON_INTERVAL_MINUTES,
  msUntilNextAutomationRun,
  normalizeCronIntervalMinutes,
  resolveLastAutomationRunAt,
} from "./cron-config";
import { isJournalPersistenceConfigured } from "@/lib/cron/journal-persistence";
import {
  isTestnetPrimaryAutomation,
  resolveAutomationPrimaryMode,
  TESTNET_PRIMARY_AUTOMATION_JOBS,
} from "./primary-mode";
import { runAutomationCycle } from "./scheduler";
import { loadAutomationState } from "./state-store";
import type { AutomationRun } from "./types";

export interface CronTickResult {
  ok: boolean;
  outcome: "RUN" | "SKIPPED" | "LOCKED";
  reason: string;
  intervalMinutes: number;
  lastRunAt: string | null;
  nextDueInMs: number;
  run?: AutomationRun;
}

export async function runCronTick(input: {
  workspaceId?: string;
  force?: boolean;
} = {}): Promise<CronTickResult> {
  const { ensureJournalDataDir } = await import("@/lib/cron/ensure-journal-dir");
  await ensureJournalDataDir().catch(() => undefined);

  const workspaceId = input.workspaceId ?? "server-default";
  const state = await loadAutomationState(workspaceId);
  const intervalMinutes = normalizeCronIntervalMinutes(state.settings.intervalMinutes);
  const lastRunAt = resolveLastAutomationRunAt(state);

  if (!input.force && !isAutomationDue(state)) {
    return {
      ok: true,
      outcome: "SKIPPED",
      reason: state.settings.paused
        ? "Automation paused."
        : state.settings.automationEnabled === false
          ? "Automation disabled."
          : "Not due yet.",
      intervalMinutes,
      lastRunAt,
      nextDueInMs: msUntilNextAutomationRun(state),
    };
  }

  if (
    state.lock.held &&
    state.lock.expiresAt &&
    Date.parse(state.lock.expiresAt) > Date.now()
  ) {
    return {
      ok: true,
      outcome: "LOCKED",
      reason: "Automation cycle already running.",
      intervalMinutes,
      lastRunAt,
      nextDueInMs: msUntilNextAutomationRun(state),
    };
  }

  const run = await runAutomationCycle({
    workspaceId,
    trigger: "cron",
    force: input.force,
  });
  invalidateMissionSnapshotCache();

  return {
    ok: run.status === "SUCCESS" || run.status === "SKIPPED" || run.status === "BLOCKED",
    outcome: "RUN",
    reason: `Cycle ${run.status}`,
    intervalMinutes,
    lastRunAt: run.completedAt ?? lastRunAt,
    nextDueInMs: intervalMinutes * 60_000,
    run,
  };
}

export async function loadCronConfigSnapshot(workspaceId = "server-default") {
  const state = await loadAutomationState(workspaceId);
  const intervalMinutes = normalizeCronIntervalMinutes(state.settings.intervalMinutes);
  const schedule = describeCronSchedule(intervalMinutes);
  return {
    workspaceId,
    automationEnabled: state.settings.automationEnabled,
    paused: state.settings.paused,
    intervalMinutes,
    primaryMode: resolveAutomationPrimaryMode(),
    testnetPrimary: isTestnetPrimaryAutomation(),
    spineJobs: isTestnetPrimaryAutomation() ? [...TESTNET_PRIMARY_AUTOMATION_JOBS] : null,
    journalPersistenceConfigured: isJournalPersistenceConfigured(),
    presets: [...CRON_INTERVAL_PRESETS],
    minIntervalMinutes: MIN_CRON_INTERVAL_MINUTES,
    maxIntervalMinutes: MAX_CRON_INTERVAL_MINUTES,
    githubCronMinMinutes: GITHUB_CRON_MIN_MINUTES,
    lastRunAt: resolveLastAutomationRunAt(state),
    nextRunAt: state.nextRunAt ?? state.settings.nextRunAt,
    nextDueInMs: msUntilNextAutomationRun(state),
    scheduleNotes: schedule,
    tickEndpoint: "/api/cron/tick",
  };
}
