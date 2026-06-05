import type { DeskManagerSettings, DeskManagerStatus } from "./types";
import { countPendingActions } from "./action-queue-store";

export function buildDeskManagerStatus(input: {
  settings: DeskManagerSettings;
  lastRun: import("./types").DeskManagerRunResult | null;
}): DeskManagerStatus {
  const now = Date.now();
  const opMs = input.settings.operationalIntervalMinutes * 60 * 1000;
  const lastOp = input.settings.lastOperationalRunAt
    ? new Date(input.settings.lastOperationalRunAt).getTime()
    : now;

  return {
    settings: input.settings,
    lastRun: input.lastRun,
    pendingActionCount: countPendingActions(),
    nextScheduledCycles: {
      operational: new Date(lastOp + opMs).toISOString(),
      dailyLearning: nextDailyRun(input.settings),
      weeklyReview: nextWeeklyRun(input.settings),
    },
  };
}

function nextDailyRun(settings: DeskManagerSettings): string | null {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(settings.dailyLearningHourUtc, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.toISOString();
}

function nextWeeklyRun(settings: DeskManagerSettings): string | null {
  const now = new Date();
  const next = new Date(now);
  const day = settings.weeklyStrategyReviewDay;
  const diff = (day - now.getUTCDay() + 7) % 7 || 7;
  next.setUTCDate(now.getUTCDate() + diff);
  next.setUTCHours(settings.dailyLearningHourUtc, 0, 0, 0);
  return next.toISOString();
}
