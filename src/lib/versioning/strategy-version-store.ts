import { getEvents } from "@/lib/journal/journal-query";
import type { StrategyVersion, StrategyVersionSnapshot } from "./strategy-version-types";

export function loadStrategyVersions(events: Awaited<ReturnType<typeof getEvents>>): StrategyVersion[] {
  const versions: StrategyVersion[] = [];
  let activeId: string | null = null;

  for (const evt of events.filter((e) => e.type === "STRATEGY_VERSION_CREATED")) {
    const p = evt.payload as unknown as StrategyVersion;
    versions.push(p);
    if (p.active) activeId = p.versionId;
  }

  for (const evt of events.filter((e) => e.type === "STRATEGY_ROLLBACK_EXECUTED")) {
    activeId = String((evt.payload as { versionId?: string }).versionId ?? activeId);
  }

  return versions
    .map((v) => ({ ...v, active: v.versionId === activeId }))
    .sort((a, b) => b.versionNumber - a.versionNumber);
}

export async function getStrategyVersionSnapshot(): Promise<StrategyVersionSnapshot> {
  const events = await getEvents();
  const versions = loadStrategyVersions(events);
  const activeVersion = versions.find((v) => v.active) ?? versions[0] ?? null;

  return { versions, activeVersion, liveLocked: true };
}

export async function getActiveStrategyVersionId(): Promise<string> {
  const snap = await getStrategyVersionSnapshot();
  return snap.activeVersion?.versionId ?? "sv-baseline-v1";
}

export async function getStrategyVersionById(versionId: string): Promise<StrategyVersion | null> {
  const snap = await getStrategyVersionSnapshot();
  return snap.versions.find((v) => v.versionId === versionId) ?? null;
}
