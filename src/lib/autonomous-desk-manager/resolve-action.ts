import type { DeskManagerAction } from "./types";

export function resolveDeskManagerActionPure(
  queue: DeskManagerAction[],
  actionId: string,
  status: "RESOLVED" | "DISMISSED",
): { queue: DeskManagerAction[]; action: DeskManagerAction | null } {
  const found = queue.find((a) => a.actionId === actionId);
  if (!found) return { queue, action: null };
  const updated: DeskManagerAction = {
    ...found,
    status,
    resolvedAt: new Date().toISOString(),
  };
  return {
    queue: queue.map((a) => (a.actionId === actionId ? updated : a)),
    action: updated,
  };
}
