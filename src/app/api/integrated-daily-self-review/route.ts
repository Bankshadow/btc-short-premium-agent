import { buildTestnetMonitorSnapshot } from "@/lib/testnet-monitor/build-testnet-monitor-snapshot";
import { INTEGRATED_DAILY_SELF_REVIEW_SAFETY_NOTICE } from "@/lib/integrated-daily-self-review/types";
import { loadDailyReviewLessonLinks } from "@/lib/integrated-daily-self-review/persist-daily-self-review-event";

export async function GET() {
  try {
    const snapshot = await buildTestnetMonitorSnapshot();
    const lessonLinks = await loadDailyReviewLessonLinks().catch(() => []);
    return Response.json({
      ok: true,
      dailySelfReview: snapshot.integratedDailySelfReview,
      lessonLinks,
      safetyNotice: INTEGRATED_DAILY_SELF_REVIEW_SAFETY_NOTICE,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load integrated daily self-review",
      },
      { status: 500 },
    );
  }
}
