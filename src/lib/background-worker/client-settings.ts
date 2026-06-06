import {
  DEFAULT_WORKER_SETTINGS,
  WORKER_LAST_RUN_STORAGE_KEY,
  WORKER_SETTINGS_STORAGE_KEY,
} from "./config";
import type { WorkerRunResult, WorkerSettings } from "./types";

export function loadClientWorkerSettings(): WorkerSettings {
  if (typeof window === "undefined") return DEFAULT_WORKER_SETTINGS;
  try {
    const raw = localStorage.getItem(WORKER_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_WORKER_SETTINGS;
    return { ...DEFAULT_WORKER_SETTINGS, ...(JSON.parse(raw) as Partial<WorkerSettings>) };
  } catch {
    return DEFAULT_WORKER_SETTINGS;
  }
}

export function saveClientWorkerSettings(
  patch: Partial<WorkerSettings>,
): WorkerSettings {
  const next = { ...loadClientWorkerSettings(), ...patch };
  if (typeof window !== "undefined") {
    localStorage.setItem(WORKER_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function loadClientWorkerLastRun(): WorkerRunResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(WORKER_LAST_RUN_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WorkerRunResult) : null;
  } catch {
    return null;
  }
}

export function saveClientWorkerLastRun(run: WorkerRunResult): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(WORKER_LAST_RUN_STORAGE_KEY, JSON.stringify(run));
  }
}
