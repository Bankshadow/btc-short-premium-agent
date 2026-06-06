import { getCronDataDir } from "@/lib/cron/cron-config";
import path from "path";
import {
  CONTINUOUS_IMPROVEMENT_MAX_PROPOSALS,
  CONTINUOUS_IMPROVEMENT_STORE_FILE,
} from "./config";
import type { ContinuousImprovementStore, ImprovementProposal } from "./types";

const memoryStore: ContinuousImprovementStore = defaultImprovementStore();

function isServer(): boolean {
  return typeof window === "undefined";
}

function storePath(): string {
  return path.join(getCronDataDir(), CONTINUOUS_IMPROVEMENT_STORE_FILE);
}

export function defaultImprovementStore(workspaceId = "server-default"): ContinuousImprovementStore {
  return {
    workspaceId,
    proposals: [],
    lastDetectAt: null,
    updatedAt: new Date().toISOString(),
  };
}

async function readStore(): Promise<ContinuousImprovementStore> {
  if (!isServer()) return memoryStore;
  try {
    const fs = await import("fs/promises");
    const raw = await fs.readFile(storePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<ContinuousImprovementStore>;
    return {
      ...defaultImprovementStore(parsed.workspaceId),
      ...parsed,
      proposals: Array.isArray(parsed.proposals) ? parsed.proposals : [],
    };
  } catch {
    return defaultImprovementStore();
  }
}

async function writeStore(store: ContinuousImprovementStore): Promise<void> {
  store.updatedAt = new Date().toISOString();
  store.proposals = store.proposals.slice(0, CONTINUOUS_IMPROVEMENT_MAX_PROPOSALS);
  if (!isServer()) {
    Object.assign(memoryStore, store);
    memoryStore.proposals = [...store.proposals];
    return;
  }
  const fs = await import("fs/promises");
  const filePath = storePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
}

export async function loadImprovementStore(
  workspaceId = "server-default",
): Promise<ContinuousImprovementStore> {
  const store = await readStore();
  store.workspaceId = workspaceId;
  return store;
}

export async function upsertImprovementProposal(
  proposal: ImprovementProposal,
  workspaceId = "server-default",
): Promise<ContinuousImprovementStore> {
  const store = await loadImprovementStore(workspaceId);
  const existing = store.proposals.find(
    (p) =>
      p.fingerprint === proposal.fingerprint &&
      !["REJECTED", "VERIFIED"].includes(p.status),
  );
  if (existing) {
    store.proposals = store.proposals.map((p) =>
      p.proposalId === existing.proposalId
        ? { ...proposal, proposalId: existing.proposalId, createdAt: existing.createdAt }
        : p,
    );
  } else {
    store.proposals = [proposal, ...store.proposals].slice(
      0,
      CONTINUOUS_IMPROVEMENT_MAX_PROPOSALS,
    );
  }
  await writeStore(store);
  return store;
}

export async function patchImprovementProposal(
  proposalId: string,
  patch: Partial<ImprovementProposal>,
  workspaceId = "server-default",
): Promise<ImprovementProposal | null> {
  const store = await loadImprovementStore(workspaceId);
  const idx = store.proposals.findIndex((p) => p.proposalId === proposalId);
  if (idx < 0) return null;
  const updated = {
    ...store.proposals[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  store.proposals[idx] = updated;
  await writeStore(store);
  return updated;
}

export async function getImprovementProposal(
  proposalId: string,
  workspaceId = "server-default",
): Promise<ImprovementProposal | null> {
  const store = await loadImprovementStore(workspaceId);
  return store.proposals.find((p) => p.proposalId === proposalId) ?? null;
}

export async function markImprovementDetectRun(
  workspaceId = "server-default",
): Promise<void> {
  const store = await loadImprovementStore(workspaceId);
  store.lastDetectAt = new Date().toISOString();
  await writeStore(store);
}

export async function resetImprovementStoreForTests(): Promise<void> {
  await writeStore(defaultImprovementStore());
}
