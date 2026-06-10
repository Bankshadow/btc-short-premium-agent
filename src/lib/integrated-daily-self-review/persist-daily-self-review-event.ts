import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import { recordMonitorEvent } from "@/lib/testnet-monitor/monitor-journal-server";
import type { DailySelfReview } from "./types";

const AUDIT_FILE = "integrated-daily-self-review-audit.json";
const LAST_FINGERPRINT_FILE = "integrated-daily-self-review-last.json";
const LESSON_LINKS_FILE = "integrated-daily-self-review-lesson-links.json";

interface DailyReviewAuditEntry {
  id: string;
  reviewId: string;
  date: string;
  tradesToday: number;
  pnlToday: number;
  recordedAt: string;
}

interface DailyReviewLessonLink {
  date: string;
  reviewId: string;
  learningRecordIds: string[];
  lessonsLearned: string[];
  updatedAt: string;
}

async function appendAudit(entry: DailyReviewAuditEntry): Promise<void> {
  const existing = await readCronJsonFile<DailyReviewAuditEntry[]>(AUDIT_FILE, []);
  const list = Array.isArray(existing) ? existing : [];
  await writeCronJsonFile(AUDIT_FILE, [entry, ...list].slice(0, 100));
}

function fingerprint(review: DailySelfReview): string {
  return `${review.date}:${review.tradesToday}:${review.pnlToday}:${review.biggestMistake.slice(0, 40)}`;
}

export async function persistDailySelfReviewCreatedSideEffects(input: {
  review: DailySelfReview;
}): Promise<{ journalWritten: boolean; lessonLinksWritten: boolean }> {
  const fp = fingerprint(input.review);
  const last = await readCronJsonFile<{ fingerprint: string; date: string }>(
    LAST_FINGERPRINT_FILE,
    { fingerprint: "", date: "" },
  );
  if (last?.fingerprint === fp && last?.date === input.review.date) {
    return { journalWritten: false, lessonLinksWritten: false };
  }

  await recordMonitorEvent({
    exchange: "BINANCE",
    environment: "TESTNET",
    eventType: "DAILY_SELF_REVIEW_CREATED",
    symbol: null,
    decisionLogId: null,
    orderId: null,
    positionId: null,
    payload: {
      reviewId: input.review.reviewId,
      date: input.review.date,
      tradesToday: input.review.tradesToday,
      pnlToday: input.review.pnlToday,
      missionProgress: input.review.missionProgress,
      biggestMistake: input.review.biggestMistake.slice(0, 200),
      tomorrowPlan: input.review.tomorrowPlan.slice(0, 240),
      lessonsLearned: input.review.lessonsLearned.slice(0, 5),
      linkedLearningRecordIds: input.review.linkedLearningRecordIds,
      advisoryOnly: true,
    },
  });

  await appendAudit({
    id: `idsr-audit-${Date.now()}`,
    reviewId: input.review.reviewId,
    date: input.review.date,
    tradesToday: input.review.tradesToday,
    pnlToday: input.review.pnlToday,
    recordedAt: new Date().toISOString(),
  });

  const linksExisting = await readCronJsonFile<DailyReviewLessonLink[]>(LESSON_LINKS_FILE, []);
  const links = Array.isArray(linksExisting) ? linksExisting : [];
  const linkEntry: DailyReviewLessonLink = {
    date: input.review.date,
    reviewId: input.review.reviewId,
    learningRecordIds: input.review.linkedLearningRecordIds,
    lessonsLearned: input.review.lessonsLearned,
    updatedAt: new Date().toISOString(),
  };
  const withoutDate = links.filter((l) => l.date !== input.review.date);
  await writeCronJsonFile(LESSON_LINKS_FILE, [linkEntry, ...withoutDate].slice(0, 30));

  await writeCronJsonFile(LAST_FINGERPRINT_FILE, {
    fingerprint: fp,
    date: input.review.date,
    updatedAt: new Date().toISOString(),
  });

  return { journalWritten: true, lessonLinksWritten: true };
}

export async function loadDailyReviewLessonLinks(): Promise<DailyReviewLessonLink[]> {
  const raw = await readCronJsonFile<DailyReviewLessonLink[]>(LESSON_LINKS_FILE, []);
  return Array.isArray(raw) ? raw : [];
}

export type { DailyReviewLessonLink };
