import type { DeskManagerSettings } from "./types";
import { DEFAULT_DESK_MANAGER_SETTINGS } from "./types";

export const DESK_MANAGER_SETTINGS_KEY = "btc-desk:desk-manager-settings";
export const DESK_MANAGER_LAST_RUN_KEY = "btc-desk:desk-manager-last-run";

export function loadDeskManagerSettings(): DeskManagerSettings {
  if (typeof window === "undefined") return DEFAULT_DESK_MANAGER_SETTINGS;
  try {
    const raw = localStorage.getItem(DESK_MANAGER_SETTINGS_KEY);
    if (!raw) return DEFAULT_DESK_MANAGER_SETTINGS;
    return { ...DEFAULT_DESK_MANAGER_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_DESK_MANAGER_SETTINGS;
  }
}

export function saveDeskManagerSettings(
  patch: Partial<DeskManagerSettings>,
): DeskManagerSettings {
  const next = { ...loadDeskManagerSettings(), ...patch };
  if (typeof window !== "undefined") {
    localStorage.setItem(DESK_MANAGER_SETTINGS_KEY, JSON.stringify(next));
  }
  return next;
}

export function shouldRunDailyLearning(
  settings: DeskManagerSettings,
  now = new Date(),
): boolean {
  if (!settings.enabled) return false;
  const last = settings.lastDailyLearningRunAt
    ? new Date(settings.lastDailyLearningRunAt)
    : null;
  const sameDay =
    last &&
    last.getUTCFullYear() === now.getUTCFullYear() &&
    last.getUTCMonth() === now.getUTCMonth() &&
    last.getUTCDate() === now.getUTCDate();
  if (sameDay) return false;
  return now.getUTCHours() >= settings.dailyLearningHourUtc;
}

export function shouldRunWeeklyReview(
  settings: DeskManagerSettings,
  now = new Date(),
): boolean {
  if (!settings.enabled) return false;
  if (now.getUTCDay() !== settings.weeklyStrategyReviewDay) return false;
  const last = settings.lastWeeklyReviewRunAt
    ? new Date(settings.lastWeeklyReviewRunAt)
    : null;
  const sameWeek =
    last &&
    Math.abs(now.getTime() - last.getTime()) < 6 * 24 * 60 * 60 * 1000;
  return !sameWeek;
}
