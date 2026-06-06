import { NextResponse } from "next/server";
import { getContinuousImprovementStatus } from "@/lib/continuous-improvement-loop/run-detect-cycle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const status = await getContinuousImprovementStatus();
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Continuous improvement status failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
