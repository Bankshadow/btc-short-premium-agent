import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import type { LiveScaleStage, ScaleApprovalRecord } from "./types";
import { defaultScaleStage } from "./stage-definitions";

const STORE_FILE = "warehouse/live-scale-up.json";

interface PersistedScaleState {
  currentStage: LiveScaleStage;
  approvalHistory: ScaleApprovalRecord[];
  updatedAt: string;
}

let memoryState: PersistedScaleState = {
  currentStage: defaultScaleStage(),
  approvalHistory: [],
  updatedAt: new Date().toISOString(),
};

export async function loadServerScaleState(): Promise<PersistedScaleState> {
  const parsed = await readCronJsonFile<Partial<PersistedScaleState>>(STORE_FILE, {});
  memoryState = {
    currentStage: parsed.currentStage ?? defaultScaleStage(),
    approvalHistory: Array.isArray(parsed.approvalHistory)
      ? parsed.approvalHistory
      : [],
    updatedAt: parsed.updatedAt ?? new Date().toISOString(),
  };
  return memoryState;
}

export async function saveServerScaleState(
  state: PersistedScaleState,
): Promise<PersistedScaleState> {
  memoryState = state;
  await writeCronJsonFile(STORE_FILE, state).catch(() => undefined);
  return memoryState;
}

export async function getEffectiveScaleStage(
  clientStage?: LiveScaleStage,
): Promise<LiveScaleStage> {
  const server = await loadServerScaleState();
  return clientStage ?? server.currentStage ?? defaultScaleStage();
}
