import {
  buildScaleUpStatus,
  demoteStage,
  LIVE_SCALE_UP_SAFETY_NOTICE,
  saveServerScaleState,
} from "@/lib/live-scale-up";
import type { ScaleUpClientPayload } from "@/lib/live-scale-up/build-scale-input";
import { defaultScaleStage } from "@/lib/live-scale-up/stage-definitions";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { report, currentStage } = await buildScaleUpStatus({});
    return NextResponse.json({
      ok: true,
      report,
      currentStage,
      safetyNotice: LIVE_SCALE_UP_SAFETY_NOTICE,
      cannotAutoPromote: true,
      btcOptionsExcluded: true,
      hint: "POST with client journal/governance for full scale-up status.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Scale-up status failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let body: ScaleUpClientPayload = {};
    try {
      body = (await request.json()) as ScaleUpClientPayload;
    } catch {
      /* empty */
    }

    let { report, currentStage } = await buildScaleUpStatus(body);
    let autoDemoted = false;

    if (report.shouldAutoDemote && report.autoDemoteTarget) {
      const demote = demoteStage(currentStage, {
        targetStage: report.autoDemoteTarget,
        auto: true,
        reasons: report.autoDemoteReasons,
        operatorNote: "Auto-demotion triggered by scale-up framework.",
      });
      if (demote.ok && demote.approvalRecord) {
        await saveServerScaleState({
          currentStage: demote.toStage,
          approvalHistory: [
            demote.approvalRecord,
            ...report.approvalHistory,
          ].slice(0, 100),
          updatedAt: new Date().toISOString(),
        });
        const refreshed = await buildScaleUpStatus({
          ...body,
          currentStage: demote.toStage,
        });
        report = refreshed.report;
        currentStage = demote.toStage;
        autoDemoted = true;
      }
    }

    return NextResponse.json({
      ok: true,
      report,
      currentStage,
      autoDemoted,
      safetyNotice: LIVE_SCALE_UP_SAFETY_NOTICE,
      cannotAutoPromote: true,
      btcOptionsExcluded: true,
      defaultStage: defaultScaleStage(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Scale-up status failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
