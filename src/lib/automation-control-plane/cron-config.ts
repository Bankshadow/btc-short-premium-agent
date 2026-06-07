import type { AutomationState } from "./types";

export const MIN_CRON_INTERVAL_MINUTES = 1;
export const MAX_CRON_INTERVAL_MINUTES = 120;
export const CRON_INTERVAL_PRESETS = [1, 3, 5, 10, 15, 30, 60] as const;

/** GitHub Actions scheduled workflows — minimum 5 minutes between invocations. */
export const GITHUB_CRON_MIN_MINUTES = 5;

export function normalizeCronIntervalMinutes(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 15;
  return Math.min(
    MAX_CRON_INTERVAL_MINUTES,
    Math.max(MIN_CRON_INTERVAL_MINUTES, Math.round(n)),
  );
}

export function resolveLastAutomationRunAt(state: AutomationState): string | null {
  return (
    state.lastRun?.completedAt ??
    state.settings.lastRunAt ??
    state.lastSuccessfulRunAt ??
    null
  );
}

export function msUntilNextAutomationRun(state: AutomationState): number {
  const intervalMs = normalizeCronIntervalMinutes(state.settings.intervalMinutes) * 60_000;
  const lastAt = resolveLastAutomationRunAt(state);
  if (!lastAt) return 0;
  const elapsed = Date.now() - Date.parse(lastAt);
  return Math.max(0, intervalMs - elapsed);
}

export function isAutomationDue(state: AutomationState, force = false): boolean {
  if (force) return true;
  if (!state.settings.automationEnabled || state.settings.paused) return false;
  if (state.lock.held && state.lock.expiresAt) {
    const expires = Date.parse(state.lock.expiresAt);
    if (Number.isFinite(expires) && expires > Date.now()) return false;
  }
  return msUntilNextAutomationRun(state) <= 0;
}

export function describeCronSchedule(intervalMinutes: number): {
  intervalMinutes: number;
  githubActionsNote: string;
  clientPollNote: string;
} {
  const interval = normalizeCronIntervalMinutes(intervalMinutes);
  const needsClientPoll = interval < GITHUB_CRON_MIN_MINUTES;
  return {
    intervalMinutes: interval,
    githubActionsNote: `GitHub Actions calls /api/cron/tick every ${GITHUB_CRON_MIN_MINUTES} minutes (platform minimum).`,
    clientPollNote: needsClientPoll
      ? `Intervals under ${GITHUB_CRON_MIN_MINUTES} min also use dashboard polling while Goal / Settings is open.`
      : "Server tick aligns with your configured interval when GitHub cron fires.",
  };
}
