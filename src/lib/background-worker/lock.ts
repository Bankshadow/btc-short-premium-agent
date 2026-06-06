import { WORKER_LOCK_TTL_MS } from "./config";
import { loadWorkerState, saveWorkerState } from "./state-store";

export type LockAcquireResult =
  | { acquired: true; runId: string }
  | { acquired: false; reason: string; heldBy: string | null };

export async function acquireWorkerLock(runId: string): Promise<LockAcquireResult> {
  const state = await loadWorkerState();
  const now = Date.now();

  if (state.lock.held && state.lock.expiresAt) {
    const expires = new Date(state.lock.expiresAt).getTime();
    if (expires > now) {
      return {
        acquired: false,
        reason: "Worker lock held — duplicate run prevented.",
        heldBy: state.lock.runId,
      };
    }
  }

  const acquiredAt = new Date().toISOString();
  const expiresAt = new Date(now + WORKER_LOCK_TTL_MS).toISOString();
  state.lock = { held: true, runId, acquiredAt, expiresAt };
  await saveWorkerState(state);
  return { acquired: true, runId };
}

export async function releaseWorkerLock(runId: string): Promise<void> {
  const state = await loadWorkerState();
  if (state.lock.runId === runId) {
    state.lock = { held: false, runId: null, acquiredAt: null, expiresAt: null };
    await saveWorkerState(state);
  }
}
