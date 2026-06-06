import { getCronDataDir } from "@/lib/cron/cron-config";
import path from "path";
import type { SecondBrainCycleSnapshot, SecondBrainMemory, SecondBrainState } from "./types";
import { SECOND_BRAIN_MAX_MEMORIES, SECOND_BRAIN_STORE_FILE } from "./config";

const memoryState: SecondBrainState = defaultSecondBrainState();

function isServer(): boolean {
  return typeof window === "undefined";
}

function storePath(): string {
  return path.join(getCronDataDir(), SECOND_BRAIN_STORE_FILE);
}

export function defaultSecondBrainState(workspaceId = "server-default"): SecondBrainState {
  const now = new Date().toISOString();
  return {
    workspaceId,
    memories: [],
    conscious: null,
    lastConsolidatedAt: null,
    lastCycleAt: null,
    lastCycleSnapshot: null,
    consolidationRuns: 0,
    conflictsResolved: 0,
    updatedAt: now,
  };
}

async function readState(): Promise<SecondBrainState> {
  if (!isServer()) return memoryState;
  try {
    const fs = await import("fs/promises");
    const raw = await fs.readFile(storePath(), "utf8");
    const parsed = JSON.parse(raw) as SecondBrainState;
    return {
      ...defaultSecondBrainState(parsed.workspaceId),
      ...parsed,
      memories: Array.isArray(parsed.memories) ? parsed.memories : [],
    };
  } catch {
    return defaultSecondBrainState();
  }
}

async function writeState(state: SecondBrainState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  state.memories = state.memories
    .filter((m) => !m.superseded)
    .slice(0, SECOND_BRAIN_MAX_MEMORIES);
  if (!isServer()) {
    Object.assign(memoryState, state);
    memoryState.memories = [...state.memories];
    return;
  }
  try {
    const fs = await import("fs/promises");
    const filePath = storePath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(state, null, 2), "utf8");
  } catch {
    Object.assign(memoryState, state);
  }
}

export async function loadSecondBrainState(
  workspaceId = "server-default",
): Promise<SecondBrainState> {
  const state = await readState();
  state.workspaceId = workspaceId;
  return state;
}

export async function saveSecondBrainState(state: SecondBrainState): Promise<void> {
  await writeState(state);
}

export async function patchSecondBrainState(
  patch: Partial<SecondBrainState>,
  workspaceId = "server-default",
): Promise<SecondBrainState> {
  const state = await loadSecondBrainState(workspaceId);
  const next = { ...state, ...patch, workspaceId };
  await saveSecondBrainState(next);
  return next;
}

export async function saveCycleSnapshot(
  snapshot: SecondBrainCycleSnapshot,
  conscious: SecondBrainState["conscious"],
  workspaceId = "server-default",
): Promise<SecondBrainState> {
  return patchSecondBrainState(
    {
      lastCycleAt: snapshot.generatedAt,
      lastCycleSnapshot: snapshot,
      conscious,
    },
    workspaceId,
  );
}

export async function resetSecondBrainStateForTests(): Promise<void> {
  await saveSecondBrainState(defaultSecondBrainState());
}

export function upsertMemoriesInState(
  state: SecondBrainState,
  incoming: SecondBrainMemory[],
): SecondBrainState {
  const byId = new Map(state.memories.map((m) => [m.memoryId, m]));
  for (const m of incoming) byId.set(m.memoryId, m);
  return {
    ...state,
    memories: [...byId.values()].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    ),
  };
}
