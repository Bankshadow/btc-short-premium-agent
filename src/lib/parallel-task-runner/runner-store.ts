import { getCronDataDir } from "@/lib/cron/cron-config";
import path from "path";
import type { ParallelTaskRunnerState, ParallelTaskRunResult } from "./types";
import { PARALLEL_RUNNER_STORE_FILE } from "./config";

const memory: ParallelTaskRunnerState = defaultParallelTaskRunnerState();

function isServer(): boolean {
  return typeof window === "undefined";
}

function storePath(): string {
  return path.join(getCronDataDir(), PARALLEL_RUNNER_STORE_FILE);
}

export function defaultParallelTaskRunnerState(
  workspaceId = "server-default",
): ParallelTaskRunnerState {
  return {
    workspaceId,
    lastRun: null,
    totalRuns: 0,
    updatedAt: new Date().toISOString(),
  };
}

async function readState(): Promise<ParallelTaskRunnerState> {
  if (!isServer()) return memory;
  try {
    const fs = await import("fs/promises");
    const raw = await fs.readFile(storePath(), "utf8");
    const parsed = JSON.parse(raw) as ParallelTaskRunnerState;
    return { ...defaultParallelTaskRunnerState(parsed.workspaceId), ...parsed };
  } catch {
    return defaultParallelTaskRunnerState();
  }
}

async function writeState(state: ParallelTaskRunnerState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  if (!isServer()) {
    Object.assign(memory, state);
    return;
  }
  try {
    const fs = await import("fs/promises");
    const filePath = storePath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(state, null, 2), "utf8");
  } catch {
    Object.assign(memory, state);
  }
}

export async function loadParallelTaskRunnerState(
  workspaceId = "server-default",
): Promise<ParallelTaskRunnerState> {
  const state = await readState();
  state.workspaceId = workspaceId;
  return state;
}

export async function saveParallelTaskRun(
  result: ParallelTaskRunResult,
): Promise<ParallelTaskRunnerState> {
  const state = await loadParallelTaskRunnerState(result.workspaceId);
  state.lastRun = result;
  state.totalRuns += 1;
  await writeState(state);
  return state;
}

export async function resetParallelTaskRunnerForTests(): Promise<void> {
  await writeState(defaultParallelTaskRunnerState());
}
