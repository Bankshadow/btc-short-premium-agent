import type { DecisionLogEntry } from "./decision-log-types";
import { loadDecisionLog, persistDecisionLog } from "./decision-log";

/** Merge remote journal entries (newer updated_at wins by timestamp). */
export function mergeDecisionLogFromRemote(
  remote: DecisionLogEntry[],
): DecisionLogEntry[] {
  if (remote.length === 0) return loadDecisionLog();

  const local = loadDecisionLog();
  const byId = new Map(local.map((e) => [e.id, e]));

  for (const entry of remote) {
    const existing = byId.get(entry.id);
    if (!existing) {
      byId.set(entry.id, entry);
      continue;
    }
    const existingTs = new Date(
      existing.resolution?.resolvedAt ?? existing.timestamp,
    ).getTime();
    const remoteTs = new Date(
      entry.resolution?.resolvedAt ?? entry.timestamp,
    ).getTime();
    if (remoteTs >= existingTs) {
      byId.set(entry.id, entry);
    }
  }

  const merged = [...byId.values()].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  return persistDecisionLog(merged);
}
