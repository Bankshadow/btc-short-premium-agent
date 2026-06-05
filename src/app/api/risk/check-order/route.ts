import {
  enrichRealTimeRiskInput,
  evaluateAndCheckOrder,
  REALTIME_RISK_SAFETY_NOTICE,
} from "@/lib/real-time-risk";
import type { OrderPreviewResult, RealTimeRiskInput } from "@/lib/real-time-risk";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = Partial<RealTimeRiskInput> & {
  preview: OrderPreviewResult;
  isCloseOrder?: boolean;
  increaseExposure?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body.preview?.symbol) {
      return NextResponse.json({ error: "preview required" }, { status: 400 });
    }

    const riskInput = await enrichRealTimeRiskInput(body);
    const result = evaluateAndCheckOrder({
      riskInput,
      preview: body.preview,
      isCloseOrder: body.isCloseOrder,
      increaseExposure: body.increaseExposure,
    });

    return NextResponse.json({
      ok: result.allowed,
      ...result,
      safetyNotice: REALTIME_RISK_SAFETY_NOTICE,
      cannotIncreaseRisk: true,
      cannotBypassGovernance: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Order risk check failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
