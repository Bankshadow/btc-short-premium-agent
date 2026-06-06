import { getCronDataDir } from "@/lib/cron/cron-config";
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
import fs from "fs/promises";
import path from "path";

function dataPath(filename: string): string {
  return path.join(getCronDataDir(), filename);
}

async function readJson<T>(filename: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(dataPath(filename), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(filename: string, value: T): Promise<void> {
  const filePath = dataPath(filename);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

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
  const state = await readJson(WORKER_STATE_FILE, defaultWorkerState());
  if (!state.settings) state.settings = { ...DEFAULT_WORKER_SETTINGS };
  return state;
}

export async function saveWorkerState(state: WorkerState): Promise<void> {
  await writeJson(WORKER_STATE_FILE, state);
}

export async function loadWorkerHistory(): Promise<WorkerRunResult[]> {
  return readJson(WORKER_HISTORY_FILE, []);
}

export async function appendWorkerHistory(run: WorkerRunResult): Promise<void> {
  const history = await loadWorkerHistory();
  const next = [run, ...history.filter((h) => h.runId !== run.runId)].slice(
    0,
    100,
  );
  await writeJson(WORKER_HISTORY_FILE, next);
}

export async function loadFailedWorkerJobs(): Promise<WorkerFailedJob[]> {
  return readJson(WORKER_FAILED_JOBS_FILE, []);
}

export async function appendFailedWorkerJob(job: WorkerFailedJob): Promise<void> {
  const failed = await loadFailedWorkerJobs();
  const next = [job, ...failed].slice(0, 50);
  await writeJson(WORKER_FAILED_JOBS_FILE, next);
}

export async function removeFailedWorkerJob(failedJobId: string): Promise<void> {
  const failed = await loadFailedWorkerJobs();
  await writeJson(
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
