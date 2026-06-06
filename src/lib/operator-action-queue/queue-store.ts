import type { OperatorAction } from "./types";

export const OPERATOR_ACTION_QUEUE_KEY = "btc-desk:operator-action-queue";

export function loadOperatorActionQueue(): OperatorAction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OPERATOR_ACTION_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as OperatorAction[]) : [];
  } catch {
    return [];
  }
}

export function saveOperatorActionQueue(actions: OperatorAction[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    OPERATOR_ACTION_QUEUE_KEY,
    JSON.stringify(actions.slice(0, 80)),
  );
}

export function mergeOperatorActionQueue(incoming: OperatorAction[]): OperatorAction[] {
  const existing = loadOperatorActionQueue();
  const openIds = new Set(
    existing.filter((a) => a.status === "OPEN").map((a) => a.actionId),
  );
  const merged = [...existing];
  for (const action of incoming) {
    if (action.status !== "OPEN" || openIds.has(action.actionId)) continue;
    merged.unshift(action);
    openIds.add(action.actionId);
  }
  const sorted = merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  saveOperatorActionQueue(sorted);
  return sorted;
}

export function resolveOperatorAction(
  actionId: string,
  status: "DONE" | "DISMISSED",
): OperatorAction[] {
  const next = loadOperatorActionQueue().map((a) =>
    a.actionId === actionId ? { ...a, status } : a,
  );
  saveOperatorActionQueue(next);
  return next;
}
