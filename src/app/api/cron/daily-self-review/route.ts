import {
  isTestModeRequest,
  verifyCronOrTestAuthorization,
} from "@/lib/cron/cron-auth";
import { runDailySelfReview } from "@/lib/daily-self-review/run-daily-self-review";
import { emitMissionAlert } from "@/lib/mission-notifications/emit-mission-alert";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 82 — end-of-day AI self-review cron. */
export async function GET(request: Request) {
  const test = isTestModeRequest(request);
  const authError = verifyCronOrTestAuthorization(request, test);
  if (authError) return authError;

  try {
    const result = await runDailySelfReview({ trigger: "cron", force: false });
    const record = result.record;

    if (record && !result.skipped) {
      await emitMissionAlert({
        kind: "cycle_complete",
        title: `Daily AI score ${record.dailyScore}/100`,
        body: [
          `Daily AI self-review · ${record.date}`,
          `Score: ${record.dailyScore}/100`,
          `Lesson: ${record.lessonLearned}`,
          `Tomorrow: ${record.tomorrowPlan.slice(0, 280)}`,
          `Mistake: ${record.biggestMistake.slice(0, 160)}`,
          `Best: ${record.bestDecision.slice(0, 160)}`,
        ].join("\n"),
      }).catch(() => null);
    }

    return NextResponse.json({
      ok: true,
      test,
      skipped: result.skipped ?? false,
      reason: result.reason ?? null,
      record,
      lessonMemoryId: result.lessonMemoryId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Daily self-review cron failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
