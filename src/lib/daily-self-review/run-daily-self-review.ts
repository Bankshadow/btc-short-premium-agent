import { getDeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import { buildGoalTradeListServer } from "@/lib/goal-engine/build-server-context";
import { evaluateMissionController } from "@/lib/mission-controller/evaluate-mission-controller";
import { buildMissionFlowServerSnapshot } from "@/lib/mission-flow/build-server-snapshot";
import { buildParallelReviewContext } from "@/lib/parallel-task-runner/build-review-context";
import { loadServerAnalysisJournal } from "@/lib/journal/journal-server-store";
import { filterProductionEntries } from "@/lib/journal/production-filter";
import { buildDailySelfReviewRecord } from "./build-daily-self-review";
import { appendDailyReviewLesson } from "./append-lesson";
import {
  appendDailySelfReview,
  getLatestDailySelfReview,
  loadDailySelfReviewStore,
} from "./review-store";
import { buildTradeQualitySummary } from "@/lib/trade-quality-score/build-summary";
import { loadTradeQualityStore } from "@/lib/trade-quality-score/quality-store";
import { DAILY_SELF_REVIEW_SAFETY_NOTICE } from "./types";
import type { DailySelfReviewRecord, DailySelfReviewStatus } from "./types";

export interface RunDailySelfReviewInput {
  workspaceId?: string;
  trigger?: DailySelfReviewRecord["trigger"];
  force?: boolean;
}

export interface RunDailySelfReviewResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  record: DailySelfReviewRecord | null;
  lessonMemoryId: string | null;
  safetyNotice: typeof DAILY_SELF_REVIEW_SAFETY_NOTICE;
  executionBlocked: true;
}

export async function getDailySelfReviewStatus(
  workspaceId = "server-default",
): Promise<DailySelfReviewStatus> {
  const store = await loadDailySelfReviewStore(workspaceId);
  const latest = store.reviews[0] ?? null;
  return {
    workspaceId,
    latest,
    lastRunAt: store.lastRunAt,
    nextDailyReviewAt: store.nextDailyReviewAt,
    reviewCount: store.reviews.length,
    safetyNotice: DAILY_SELF_REVIEW_SAFETY_NOTICE,
  };
}

export async function runDailySelfReview(
  input: RunDailySelfReviewInput = {},
): Promise<RunDailySelfReviewResult> {
  const workspaceId = input.workspaceId ?? "server-default";
  const trigger = input.trigger ?? "manual";
  const store = await loadDailySelfReviewStore(workspaceId);

  if (!input.force && store.nextDailyReviewAt) {
    const nextAt = Date.parse(store.nextDailyReviewAt);
    if (Number.isFinite(nextAt) && Date.now() < nextAt) {
      const latest = await getLatestDailySelfReview(workspaceId);
      return {
        ok: true,
        skipped: true,
        reason: "Daily self-review not due yet.",
        record: latest,
        lessonMemoryId: null,
        safetyNotice: DAILY_SELF_REVIEW_SAFETY_NOTICE,
        executionBlocked: true,
      };
    }
  }

  const [mission, flow, entriesRaw, trades, ctx] = await Promise.all([
    evaluateMissionController(),
    buildMissionFlowServerSnapshot({ fresh: true }),
    loadServerAnalysisJournal().catch(() => []),
    buildGoalTradeListServer().catch(() => []),
    buildParallelReviewContext({
      riskProfile: getDeskRiskProfile(),
      workspaceId,
    }),
  ]);

  const entries = filterProductionEntries(entriesRaw);
  const tradeQualityStore = await loadTradeQualityStore(workspaceId).catch(() => null);
  const tradeQuality = tradeQualityStore
    ? buildTradeQualitySummary(tradeQualityStore.scores)
    : null;
  const record = buildDailySelfReviewRecord({
    trigger,
    mission,
    snapshot: flow.snapshot,
    ctx,
    entries,
    trades,
    tradeQuality,
  });

  await appendDailySelfReview(record, workspaceId);
  const lesson = await appendDailyReviewLesson(record, workspaceId);

  return {
    ok: true,
    record,
    lessonMemoryId: lesson.memoryId,
    safetyNotice: DAILY_SELF_REVIEW_SAFETY_NOTICE,
    executionBlocked: true,
  };
}
