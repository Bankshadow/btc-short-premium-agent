import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import type { OperatorAction } from "@/lib/operator-action-queue/types";
import {
  AUTOMATION_ACTIONS_FILE,
  AUTOMATION_FAILED_FILE,
  AUTOMATION_HISTORY_FILE,
  AUTOMATION_IDEMPOTENCY_FILE,
  AUTOMATION_MAX_ACTIONS,
  AUTOMATION_MAX_FAILED,
  AUTOMATION_MAX_HISTORY,
  AUTOMATION_STATE_FILE,
  DEFAULT_AUTOMATION_SETTINGS,
} from "./config";
import { normalizeCronIntervalMinutes } from "./cron-config";
import type {
  AutomationFailedJob,
  AutomationRun,
  AutomationSettings,
  AutomationState,
} from "./types";

export function defaultAutomationState(workspaceId = "server-default"): AutomationState {
  return {
    workspaceId,
    lock: { held: false, runId: null, acquiredAt: null, expiresAt: null },
    jobLocks: {},
    settings: { ...DEFAULT_AUTOMATION_SETTINGS, moduleToggles: { ...DEFAULT_AUTOMATION_SETTINGS.moduleToggles } },
    lastRun: null,
    lastSuccessfulRunAt: null,
    nextRunAt: null,
    consecutiveFailures: {},
    recentIdempotencyKeys: [],
  };
}

export async function loadAutomationState(
  workspaceId = "server-default",
): Promise<AutomationState> {
  const state = await readCronJsonFile(AUTOMATION_STATE_FILE, defaultAutomationState(workspaceId));
  if (!state.settings) state.settings = { ...DEFAULT_AUTOMATION_SETTINGS };
  if (!state.settings.moduleToggles) {
    state.settings.moduleToggles = { ...DEFAULT_AUTOMATION_SETTINGS.moduleToggles };
  } else {
    state.settings.moduleToggles = {
      ...DEFAULT_AUTOMATION_SETTINGS.moduleToggles,
      ...state.settings.moduleToggles,
    };
  }
  state.workspaceId = workspaceId;
  return state;
}

export async function saveAutomationState(state: AutomationState): Promise<void> {
  await writeCronJsonFile(AUTOMATION_STATE_FILE, state);
}

export async function loadAutomationHistory(): Promise<AutomationRun[]> {
  return readCronJsonFile(AUTOMATION_HISTORY_FILE, []);
}

export async function appendAutomationHistory(run: AutomationRun): Promise<void> {
  const history = await loadAutomationHistory();
  const next = [run, ...history.filter((h) => h.runId !== run.runId)].slice(
    0,
    AUTOMATION_MAX_HISTORY,
  );
  await writeCronJsonFile(AUTOMATION_HISTORY_FILE, next);
}

export async function loadFailedAutomationJobs(): Promise<AutomationFailedJob[]> {
  return readCronJsonFile(AUTOMATION_FAILED_FILE, []);
}

export async function appendFailedAutomationJob(
  job: AutomationFailedJob,
): Promise<void> {
  const failed = await loadFailedAutomationJobs();
  const next = [job, ...failed].slice(0, AUTOMATION_MAX_FAILED);
  await writeCronJsonFile(AUTOMATION_FAILED_FILE, next);
}

export async function removeFailedAutomationJob(
  failedJobId: string,
): Promise<void> {
  const failed = await loadFailedAutomationJobs();
  await writeCronJsonFile(
    AUTOMATION_FAILED_FILE,
    failed.filter((f) => f.failedJobId !== failedJobId),
  );
}

export async function patchAutomationSettings(
  patch: Partial<AutomationSettings>,
  workspaceId = "server-default",
): Promise<AutomationSettings> {
  const state = await loadAutomationState(workspaceId);
  state.settings = {
    ...state.settings,
    ...patch,
    intervalMinutes:
      patch.intervalMinutes !== undefined
        ? normalizeCronIntervalMinutes(patch.intervalMinutes)
        : state.settings.intervalMinutes,
    moduleToggles: {
      ...state.settings.moduleToggles,
      ...(patch.moduleToggles ?? {}),
    },
  };
  await saveAutomationState(state);
  return state.settings;
}

export async function loadRecentIdempotencyKeys(): Promise<string[]> {
  return readCronJsonFile(AUTOMATION_IDEMPOTENCY_FILE, []);
}

export async function recordIdempotencyKey(key: string): Promise<void> {
  const keys = await loadRecentIdempotencyKeys();
  const next = [key, ...keys.filter((k) => k !== key)].slice(0, 200);
  await writeCronJsonFile(AUTOMATION_IDEMPOTENCY_FILE, next);
}

export async function loadServerPendingOperatorActions(): Promise<OperatorAction[]> {
  return readCronJsonFile(AUTOMATION_ACTIONS_FILE, []);
}

export async function saveServerPendingOperatorActions(
  actions: OperatorAction[],
): Promise<void> {
  await writeCronJsonFile(AUTOMATION_ACTIONS_FILE, actions.slice(0, AUTOMATION_MAX_ACTIONS));
}

export async function mergeServerPendingOperatorActions(
  incoming: OperatorAction[],
): Promise<OperatorAction[]> {
  const existing = await loadServerPendingOperatorActions();
  const byId = new Map(existing.map((a) => [a.actionId, a]));
  for (const a of incoming) {
    if (a.status === "OPEN") byId.set(a.actionId, a);
  }
  const merged = [...byId.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  await saveServerPendingOperatorActions(merged);
  return merged;
}
