import fs from "fs/promises";
import path from "path";
import { getCronDataDir } from "@/lib/cron/cron-config";

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

function prefsPath(): string {
  return path.join(getCronDataDir(), PREFS_FILE);
}

export async function loadGoalNotificationPrefs(): Promise<GoalNotificationPrefs> {
  try {
    const raw = await fs.readFile(prefsPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<GoalNotificationPrefs>;
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export async function saveGoalNotificationPrefs(
  patch: Partial<GoalNotificationPrefs>,
): Promise<GoalNotificationPrefs> {
  const current = await loadGoalNotificationPrefs();
  const next = { ...current, ...patch };
  const filePath = prefsPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(next, null, 2), "utf8");
  return next;
}
