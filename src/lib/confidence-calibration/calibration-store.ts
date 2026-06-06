import { getCronDataDir } from "@/lib/cron/cron-config";
import path from "path";
import {
  CONFIDENCE_CALIBRATION_MAX_SAMPLES,
  CONFIDENCE_CALIBRATION_STORE_FILE,
} from "./config";
import {
  getCachedCalibrationProfile,
  setCachedCalibrationProfile,
} from "./calibration-cache";
import type {
  ConfidenceCalibrationSample,
  ConfidenceCalibrationStore,
} from "./types";

const memoryStore: ConfidenceCalibrationStore = defaultCalibrationStore();

function isServer(): boolean {
  return typeof window === "undefined";
}

function storePath(): string {
  return path.join(getCronDataDir(), CONFIDENCE_CALIBRATION_STORE_FILE);
}

export function defaultCalibrationStore(workspaceId = "server-default"): ConfidenceCalibrationStore {
  return {
    workspaceId,
    samples: [],
    profile: null,
    lastUpdatedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

export { getCachedCalibrationProfile } from "./calibration-cache";

async function readStore(): Promise<ConfidenceCalibrationStore> {
  if (!isServer()) return memoryStore;
  try {
    const fs = await import("fs/promises");
    const raw = await fs.readFile(storePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<ConfidenceCalibrationStore>;
    return {
      ...defaultCalibrationStore(parsed.workspaceId),
      ...parsed,
      samples: Array.isArray(parsed.samples) ? parsed.samples : [],
      profile: parsed.profile ?? null,
    };
  } catch {
    return defaultCalibrationStore();
  }
}

async function writeStore(store: ConfidenceCalibrationStore): Promise<void> {
  store.updatedAt = new Date().toISOString();
  store.samples = store.samples.slice(0, CONFIDENCE_CALIBRATION_MAX_SAMPLES);
  setCachedCalibrationProfile(store.profile);
  if (!isServer()) {
    Object.assign(memoryStore, store);
    memoryStore.samples = [...store.samples];
    return;
  }
  const fs = await import("fs/promises");
  const filePath = storePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
}

export async function loadCalibrationStore(
  workspaceId = "server-default",
): Promise<ConfidenceCalibrationStore> {
  const store = await readStore();
  store.workspaceId = workspaceId;
  setCachedCalibrationProfile(store.profile);
  return store;
}

export async function saveCalibrationStore(
  store: ConfidenceCalibrationStore,
): Promise<ConfidenceCalibrationStore> {
  await writeStore(store);
  return store;
}

export async function upsertCalibrationSamples(
  incoming: ConfidenceCalibrationSample[],
  workspaceId = "server-default",
): Promise<ConfidenceCalibrationStore> {
  const store = await loadCalibrationStore(workspaceId);
  const byId = new Map(store.samples.map((s) => [s.sampleId, s]));
  for (const sample of incoming) byId.set(sample.sampleId, sample);
  store.samples = [...byId.values()]
    .sort((a, b) => Date.parse(b.evaluatedAt) - Date.parse(a.evaluatedAt))
    .slice(0, CONFIDENCE_CALIBRATION_MAX_SAMPLES);
  return saveCalibrationStore(store);
}

export async function resetCalibrationStoreForTests(): Promise<void> {
  setCachedCalibrationProfile(null);
  await writeStore(defaultCalibrationStore());
}
