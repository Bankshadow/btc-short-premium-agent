import type { DeskManagerAction } from "./types";
import { resolveDeskManagerActionPure } from "./resolve-action";

export const DESK_MANAGER_ACTION_QUEUE_KEY = "btc-desk:desk-manager-action-queue";

export function loadActionQueue(): DeskManagerAction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DESK_MANAGER_ACTION_QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DeskManagerAction[];
  } catch {
    return [];
  }
}

export function saveActionQueue(actions: DeskManagerAction[]): DeskManagerAction[] {
  const capped = actions.slice(0, 120);
  if (typeof window !== "undefined") {
    localStorage.setItem(DESK_MANAGER_ACTION_QUEUE_KEY, JSON.stringify(capped));
  }
  return capped;
}

export function mergeActionQueue(
  incoming: DeskManagerAction[],
): DeskManagerAction[] {
  const existing = loadActionQueue().filter((a) => a.status === "PENDING");
  const resolved = loadActionQueue().filter((a) => a.status !== "PENDING");
  const byId = new Map(existing.map((a) => [a.actionId, a]));
  for (const action of incoming) {
    if (!byId.has(action.actionId)) {
      byId.set(action.actionId, action);
    }
  }
  return saveActionQueue([
    ...[...byId.values()].sort(
      (a, b) =>
        priorityRank(b.priority) - priorityRank(a.priority) ||
        b.createdAt.localeCompare(a.createdAt),
    ),
    ...resolved,
  ]);
}

function priorityRank(p: DeskManagerAction["priority"]): number {
  if (p === "HIGH") return 3;
  if (p === "MEDIUM") return 2;
  return 1;
}

export function resolveAction(
  actionId: string,
  status: "RESOLVED" | "DISMISSED",
): DeskManagerAction | null {
  const { queue, action } = resolveDeskManagerActionPure(
    loadActionQueue(),
    actionId,
    status,
  );
  if (!action) return null;
  saveActionQueue(queue);
  return action;
}

export function countPendingActions(): number {
  return loadActionQueue().filter((a) => a.status === "PENDING").length;
}
