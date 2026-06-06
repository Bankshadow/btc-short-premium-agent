import { WORKER_IDEMPOTENCY_WINDOW_MS } from "./config";
import { loadWorkerHistory } from "./state-store";

export function buildWorkerIdempotencyKey(input: {
  trigger: string;
  jobs?: string[];
  runMinute?: string;
}): string {
  const minute =
    input.runMinute ?? new Date().toISOString().slice(0, 16);
  const jobs = (input.jobs ?? ["full"]).join(",");
  return `wk-${input.trigger}-${jobs}-${minute}`;
}

export async function isDuplicateWorkerRun(
  idempotencyKey: string,
): Promise<boolean> {
  const history = await loadWorkerHistory();
  const windowStart = Date.now() - WORKER_IDEMPOTENCY_WINDOW_MS;
  return history.some(
    (h) =>
      h.idempotencyKey === idempotencyKey &&
      h.status === "COMPLETED" &&
      h.completedAt != null &&
      new Date(h.completedAt).getTime() >= windowStart,
  );
}
