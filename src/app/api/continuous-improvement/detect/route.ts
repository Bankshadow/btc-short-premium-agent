import { NextResponse } from "next/server";
import { runContinuousImprovementDetect } from "@/lib/continuous-improvement-loop/run-detect-cycle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await runContinuousImprovementDetect();
    return NextResponse.json({
      ...result,
      ok: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Continuous improvement detect failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
