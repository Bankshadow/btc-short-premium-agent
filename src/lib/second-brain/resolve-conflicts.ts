import type { MemoryPolarity, SecondBrainMemory } from "./types";

function oppositePolarity(a: MemoryPolarity, b: MemoryPolarity): boolean {
  return (
    (a === "positive" && b === "negative") ||
    (a === "negative" && b === "positive")
  );
}

export function resolveMemoryConflicts(
  memories: SecondBrainMemory[],
): { memories: SecondBrainMemory[]; resolvedCount: number } {
  const active = memories.filter((m) => !m.superseded);
  const byKey = new Map<string, SecondBrainMemory[]>();

  for (const m of active) {
    const list = byKey.get(m.conflictKey) ?? [];
    list.push(m);
    byKey.set(m.conflictKey, list);
  }

  let resolvedCount = 0;
  const supersededIds = new Set<string>();

  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (!oppositePolarity(a.polarity, b.polarity)) continue;

        const winner =
          a.confidence > b.confidence
            ? a
            : b.confidence > a.confidence
              ? b
              : new Date(a.updatedAt).getTime() >= new Date(b.updatedAt).getTime()
                ? a
                : b;
        const loser = winner.memoryId === a.memoryId ? b : a;
        if (!supersededIds.has(loser.memoryId)) {
          supersededIds.add(loser.memoryId);
          resolvedCount += 1;
        }
      }
    }
  }

  const next = memories.map((m) => {
    if (!supersededIds.has(m.memoryId)) return m;
    const peers = byKey.get(m.conflictKey) ?? [];
    const winner = peers
      .filter((p) => !supersededIds.has(p.memoryId))
      .sort((x, y) => y.confidence - x.confidence)[0];
    return {
      ...m,
      superseded: true,
      supersededBy: winner?.memoryId ?? null,
      updatedAt: new Date().toISOString(),
    };
  });

  return { memories: next, resolvedCount };
}
