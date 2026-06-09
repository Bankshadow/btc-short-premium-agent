import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import type { ParallelTaskRunnerState, ParallelTaskRunResult } from "./types";
import { PARALLEL_RUNNER_STORE_FILE } from "./config";

const memory: ParallelTaskRunnerState = defaultParallelTaskRunnerState();

function isServer(): boolean {
  return typeof window === "undefined";
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
  const parsed = await readCronJsonFile<ParallelTaskRunnerState>(
    PARALLEL_RUNNER_STORE_FILE,
    defaultParallelTaskRunnerState(),
  );
  return { ...defaultParallelTaskRunnerState(parsed.workspaceId), ...parsed };
}

async function writeState(state: ParallelTaskRunnerState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  if (!isServer()) {
    Object.assign(memory, state);
    return;
  }
  try {
    await writeCronJsonFile(PARALLEL_RUNNER_STORE_FILE, state);
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
