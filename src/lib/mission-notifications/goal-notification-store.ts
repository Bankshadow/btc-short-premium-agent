import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";

const PREFS_FILE = "goal-notification-prefs.json";

export interface GoalNotificationPrefs {
  notifyOnTrade: boolean;
  notifyOnBlocker: boolean;
  lastAlertAt: string | null;
}

const DEFAULT_PREFS: GoalNotificationPrefs = {
  notifyOnTrade: true,
  notifyOnBlocker: true,
  lastAlertAt: null,
};

export async function loadGoalNotificationPrefs(): Promise<GoalNotificationPrefs> {
  const parsed = await readCronJsonFile<Partial<GoalNotificationPrefs>>(
    PREFS_FILE,
    {},
  );
  return { ...DEFAULT_PREFS, ...parsed };
}

export async function saveGoalNotificationPrefs(
  patch: Partial<GoalNotificationPrefs>,
): Promise<GoalNotificationPrefs> {
  const current = await loadGoalNotificationPrefs();
  const next = { ...current, ...patch };
  await writeCronJsonFile(PREFS_FILE, next);
  return next;
}
