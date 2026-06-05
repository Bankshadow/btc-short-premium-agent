import {
  buildScaleUpInput,
  buildScaleUpStatus,
  promoteStage,
  saveServerScaleState,
  LIVE_SCALE_UP_SAFETY_NOTICE,
} from "@/lib/live-scale-up";
import type { ScaleUpClientPayload } from "@/lib/live-scale-up/build-scale-input";
import type { PromoteStageRequest } from "@/lib/live-scale-up/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = ScaleUpClientPayload & PromoteStageRequest;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const { input, currentStage } = await buildScaleUpInput(body);

    const result = promoteStage(input, {
      targetStage: body.targetStage,
      operatorApproval: body.operatorApproval,
      operatorNote: body.operatorNote,
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
      cannotAutoPromote: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Promotion failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
