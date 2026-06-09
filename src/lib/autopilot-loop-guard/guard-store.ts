import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import type { LoopGuardActionRecord, LoopGuardState } from "./types";
import { LOOP_GUARD_MAX_RECORDS, LOOP_GUARD_STORE_FILE } from "./config";

const memoryState: LoopGuardState = defaultLoopGuardState();

function isServer(): boolean {
  return typeof window === "undefined";
}

export function defaultLoopGuardState(workspaceId = "server-default"): LoopGuardState {
  const now = new Date().toISOString();
  return {
    workspaceId,
    records: [],
    blocker: {
      active: false,
      reason: "",
      stoppedAt: null,
      actionItemId: null,
      loopRiskLevel: null,
      metrics: null,
    },
    suspiciousPermissionGrantedUntil: null,
    lastSelfCheckAt: null,
    lastSelfCheckSummary: null,
    updatedAt: now,
  };
}

async function readServerState(): Promise<LoopGuardState> {
  if (!isServer()) return memoryState;
  const parsed = await readCronJsonFile<LoopGuardState>(LOOP_GUARD_STORE_FILE, defaultLoopGuardState());
  return {
    ...defaultLoopGuardState(parsed.workspaceId),
    ...parsed,
    records: Array.isArray(parsed.records) ? parsed.records : [],
    blocker: {
      ...defaultLoopGuardState().blocker,
      ...(parsed.blocker ?? {}),
    },
  };
}

async function writeServerState(state: LoopGuardState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  if (!isServer()) {
    Object.assign(memoryState, state);
    memoryState.records = [...state.records];
    return;
  }
  try {
    await writeCronJsonFile(LOOP_GUARD_STORE_FILE, state);
  } catch {
    Object.assign(memoryState, state);
  }
}

export async function loadLoopGuardState(
  workspaceId = "server-default",
): Promise<LoopGuardState> {
  const state = await readServerState();
  state.workspaceId = workspaceId;
  return state;
}

export async function saveLoopGuardState(state: LoopGuardState): Promise<void> {
  await writeServerState(state);
}

export async function appendLoopGuardRecord(
  record: LoopGuardActionRecord,
  workspaceId = "server-default",
): Promise<LoopGuardState> {
  const state = await loadLoopGuardState(workspaceId);
  state.records = [record, ...state.records].slice(0, LOOP_GUARD_MAX_RECORDS);
  await saveLoopGuardState(state);
  return state;
}

export async function patchLoopGuardState(
  patch: Partial<LoopGuardState>,
  workspaceId = "server-default",
): Promise<LoopGuardState> {
  const state = await loadLoopGuardState(workspaceId);
  const next = { ...state, ...patch, workspaceId };
  await saveLoopGuardState(next);
  return next;
}

/** Test helper — reset in-memory/server state. */
export async function resetLoopGuardStateForTests(): Promise<void> {
  const fresh = defaultLoopGuardState();
  await saveLoopGuardState(fresh);
}
