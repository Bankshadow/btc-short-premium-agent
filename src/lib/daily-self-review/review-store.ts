import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import {
  DAILY_SELF_REVIEW_INTERVAL_HOURS,
  DAILY_SELF_REVIEW_MAX_RECORDS,
  DAILY_SELF_REVIEW_STORE_FILE,
} from "./config";
import type { DailySelfReviewRecord, DailySelfReviewStore } from "./types";

const memoryStore: DailySelfReviewStore = defaultDailySelfReviewStore();

function isServer(): boolean {
  return typeof window === "undefined";
}

export function defaultDailySelfReviewStore(
  workspaceId = "server-default",
): DailySelfReviewStore {
  const now = Date.now();
  return {
    workspaceId,
    reviews: [],
    lastRunAt: null,
    nextDailyReviewAt: new Date(
      now + DAILY_SELF_REVIEW_INTERVAL_HOURS * 60 * 60 * 1000,
    ).toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function readStore(): Promise<DailySelfReviewStore> {
  if (!isServer()) return memoryStore;
  const parsed = await readCronJsonFile<Partial<DailySelfReviewStore>>(
    DAILY_SELF_REVIEW_STORE_FILE,
    {},
  );
  return {
    ...defaultDailySelfReviewStore(parsed.workspaceId),
    ...parsed,
    reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
  };
}

async function writeStore(store: DailySelfReviewStore): Promise<void> {
  store.updatedAt = new Date().toISOString();
  store.reviews = store.reviews.slice(0, DAILY_SELF_REVIEW_MAX_RECORDS);
  if (!isServer()) {
    Object.assign(memoryStore, store);
    memoryStore.reviews = [...store.reviews];
    return;
  }
  await writeCronJsonFile(DAILY_SELF_REVIEW_STORE_FILE, store);
}

export async function loadDailySelfReviewStore(
  workspaceId = "server-default",
): Promise<DailySelfReviewStore> {
  const store = await readStore();
  store.workspaceId = workspaceId;
  return store;
}

export async function appendDailySelfReview(
  record: DailySelfReviewRecord,
  workspaceId = "server-default",
): Promise<DailySelfReviewStore> {
  const store = await loadDailySelfReviewStore(workspaceId);
  store.reviews = [
    record,
    ...store.reviews.filter((r) => r.reviewId !== record.reviewId && r.date !== record.date),
  ].slice(0, DAILY_SELF_REVIEW_MAX_RECORDS);
  store.lastRunAt = record.generatedAt;
  store.nextDailyReviewAt = new Date(
    Date.parse(record.generatedAt) + DAILY_SELF_REVIEW_INTERVAL_HOURS * 60 * 60 * 1000,
  ).toISOString();
  await writeStore(store);
  return store;
}

export async function getLatestDailySelfReview(
  workspaceId = "server-default",
): Promise<DailySelfReviewRecord | null> {
  const store = await loadDailySelfReviewStore(workspaceId);
  return store.reviews[0] ?? null;
}

export async function resetDailySelfReviewForTests(): Promise<void> {
  await writeStore(defaultDailySelfReviewStore());
}
