import { getCronDataDir } from "@/lib/cron/cron-config";
import type { LiveScaleStage, ScaleApprovalRecord } from "./types";
import { defaultScaleStage } from "./stage-definitions";
import fs from "fs/promises";
import path from "path";

const STORE_FILE = "live-scale-up.json";

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

function storePath(): string {
  return path.join(getCronDataDir(), "warehouse", STORE_FILE);
}

export async function loadServerScaleState(): Promise<PersistedScaleState> {
  try {
    const raw = await fs.readFile(storePath(), "utf8");
    const parsed = JSON.parse(raw) as PersistedScaleState;
    memoryState = {
      currentStage: parsed.currentStage ?? defaultScaleStage(),
      approvalHistory: Array.isArray(parsed.approvalHistory)
        ? parsed.approvalHistory
        : [],
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
    return memoryState;
  } catch {
    return memoryState;
  }
}

export async function saveServerScaleState(
  state: PersistedScaleState,
): Promise<PersistedScaleState> {
  memoryState = state;
  try {
    await fs.mkdir(path.dirname(storePath()), { recursive: true });
    await fs.writeFile(storePath(), JSON.stringify(state, null, 2), "utf8");
  } catch {
    /* memory only */
  }
  return memoryState;
}

export async function getEffectiveScaleStage(
  clientStage?: LiveScaleStage,
): Promise<LiveScaleStage> {
  const server = await loadServerScaleState();
  return clientStage ?? server.currentStage ?? defaultScaleStage();
}
