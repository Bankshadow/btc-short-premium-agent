import { buildMissionSnapshot } from "@/lib/mission/mission-snapshot";
import type { MissionSnapshot } from "@/lib/mission/mission-types";
import type { JournalEvent } from "@/lib/journal/journal-types";

export function buildMissionProjection(events: JournalEvent[]): MissionSnapshot {
  return buildMissionSnapshot(events);
}

export function zeroMissionProjection(): MissionSnapshot {
  return buildMissionSnapshot([]);
}
