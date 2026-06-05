import {
  enrichRealTimeRiskInput,
  evaluateRealTimeRisk,
  REALTIME_RISK_SAFETY_NOTICE,
} from "@/lib/real-time-risk";
import type { RealTimeRiskInput } from "@/lib/real-time-risk";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const input = await enrichRealTimeRiskInput({ entries: [], orders: [] });
    const report = evaluateRealTimeRisk(input);
    return NextResponse.json({
      ok: true,
      report,
      safetyNotice: REALTIME_RISK_SAFETY_NOTICE,
      cannotIncreaseRisk: true,
      cannotBypassGovernance: true,
      hint: "POST with client journal/governance for full real-time risk evaluation.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Real-time risk failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let body: Partial<RealTimeRiskInput> = {};
    try {
      body = (await request.json()) as Partial<RealTimeRiskInput>;
    } catch {
      /* empty body */
    }

    const input = await enrichRealTimeRiskInput(body);
    const report = evaluateRealTimeRisk(input);

    return NextResponse.json({
      ok: true,
      report,
      safetyNotice: REALTIME_RISK_SAFETY_NOTICE,
      cannotIncreaseRisk: true,
      cannotBypassGovernance: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Real-time risk failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
