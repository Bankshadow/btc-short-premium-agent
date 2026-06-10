import { getEvents } from "@/lib/journal/journal-query";
import { appendEvent } from "@/lib/journal/journal-query";
import { buildMissionSnapshot } from "@/lib/mission/mission-snapshot";
import { getLatestSwarmReport } from "@/lib/skills/mirofish-swarm/swarm-runner";
import { classifyRegime } from "./regime-classifier";
import {
  buildRegimeMemoryFromEvents,
  retrieveSimilarRegimeTrades,
} from "./regime-memory";
import type { RegimeClassification, RegimeMemoryResult } from "./regime-types";

export async function classifyAndStoreRegime(): Promise<RegimeClassification> {
  const events = await getEvents();
  const mission = buildMissionSnapshot(events);
  const swarm = await getLatestSwarmReport();
  const classification = classifyRegime({ mission, swarmReport: swarm });

  await appendEvent({
    type: "REGIME_CLASSIFIED",
    environment: "testnet",
    payload: { ...classification },
  });

  return classification;
}

export async function retrieveRegimeMemory(
  regime?: RegimeClassification,
): Promise<RegimeMemoryResult> {
  const events = await getEvents();
  const current =
    regime ??
    (() => {
      const evt = [...events]
        .filter((e) => e.type === "REGIME_CLASSIFIED")
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
      if (evt) {
        const p = evt.payload as unknown as RegimeClassification;
        return p;
      }
      const mission = buildMissionSnapshot(events);
      return classifyRegime({ mission, swarmReport: null });
    })();

  const memory = buildRegimeMemoryFromEvents(events);
  const result = retrieveSimilarRegimeTrades(current.regime, memory);

  await appendEvent({
    type: "REGIME_MEMORY_RETRIEVED",
    environment: "testnet",
    payload: {
      currentRegime: result.currentRegime,
      similarCount: result.similarTrades.length,
      lessonCount: result.lessons.length,
    },
  });

  return result;
}

export async function getLatestRegimeClassification(): Promise<RegimeClassification | null> {
  const events = await getEvents();
  const evt = [...events]
    .filter((e) => e.type === "REGIME_CLASSIFIED")
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  if (!evt) return null;
  return evt.payload as unknown as RegimeClassification;
}
