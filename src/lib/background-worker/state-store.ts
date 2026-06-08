import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import {
  DEFAULT_WORKER_SETTINGS,
  WORKER_FAILED_JOBS_FILE,
  WORKER_HISTORY_FILE,
  WORKER_STATE_FILE,
} from "./config";
import type {
  WorkerFailedJob,
  WorkerRunResult,
  WorkerSettings,
  WorkerState,
} from "./types";

export function defaultWorkerState(): WorkerState {
  return {
    lock: { held: false, runId: null, acquiredAt: null, expiresAt: null },
    settings: { ...DEFAULT_WORKER_SETTINGS },
    lastRun: null,
    lastSuccessfulRunAt: null,
    nextRunAt: null,
  };
}

export async function loadWorkerState(): Promise<WorkerState> {
  const state = await readCronJsonFile(WORKER_STATE_FILE, defaultWorkerState());
  if (!state.settings) state.settings = { ...DEFAULT_WORKER_SETTINGS };
  return state;
}

export async function saveWorkerState(state: WorkerState): Promise<void> {
  await writeCronJsonFile(WORKER_STATE_FILE, state);
}

export async function loadWorkerHistory(): Promise<WorkerRunResult[]> {
  return readCronJsonFile(WORKER_HISTORY_FILE, []);
}

export async function appendWorkerHistory(run: WorkerRunResult): Promise<void> {
  const history = await loadWorkerHistory();
  const next = [run, ...history.filter((h) => h.runId !== run.runId)].slice(
    0,
    100,
  );
  await writeCronJsonFile(WORKER_HISTORY_FILE, next);
}

export async function loadFailedWorkerJobs(): Promise<WorkerFailedJob[]> {
  return readCronJsonFile(WORKER_FAILED_JOBS_FILE, []);
}

export async function appendFailedWorkerJob(job: WorkerFailedJob): Promise<void> {
  const failed = await loadFailedWorkerJobs();
  const next = [job, ...failed].slice(0, 50);
  await writeCronJsonFile(WORKER_FAILED_JOBS_FILE, next);
}

export async function removeFailedWorkerJob(failedJobId: string): Promise<void> {
  const failed = await loadFailedWorkerJobs();
  await writeCronJsonFile(
    WORKER_FAILED_JOBS_FILE,
    failed.filter((f) => f.failedJobId !== failedJobId),
  );
}

export async function patchWorkerSettings(
  patch: Partial<WorkerSettings>,
): Promise<WorkerSettings> {
  const state = await loadWorkerState();
  state.settings = { ...state.settings, ...patch };
  await saveWorkerState(state);
  return state.settings;
}
