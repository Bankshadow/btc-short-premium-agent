import {
  buildScaleUpInput,
  buildScaleUpStatus,
  demoteStage,
  saveServerScaleState,
  LIVE_SCALE_UP_SAFETY_NOTICE,
} from "@/lib/live-scale-up";
import type { ScaleUpClientPayload } from "@/lib/live-scale-up/build-scale-input";
import type { DemoteStageRequest } from "@/lib/live-scale-up/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = ScaleUpClientPayload & DemoteStageRequest;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const { input, currentStage } = await buildScaleUpInput(body);

    const result = demoteStage(currentStage, {
      targetStage: body.targetStage,
      operatorNote: body.operatorNote,
      reasons: body.reasons,
      auto: body.auto,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ...result, safetyNotice: LIVE_SCALE_UP_SAFETY_NOTICE },
        { status: 422 },
      );
    }

    if (result.approvalRecord) {
      await saveServerScaleState({
        currentStage: result.toStage,
        approvalHistory: [
          result.approvalRecord,
          ...(input.approvalHistory ?? []),
        ].slice(0, 100),
        updatedAt: new Date().toISOString(),
      });
    }

    const updated = await buildScaleUpStatus({
      ...body,
      currentStage: result.toStage,
    });

    return NextResponse.json({
      ...result,
      report: updated.report,
      currentStage: result.toStage,
      safetyNotice: LIVE_SCALE_UP_SAFETY_NOTICE,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Demotion failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
