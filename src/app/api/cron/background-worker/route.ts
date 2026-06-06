import {
  isTestModeRequest,
  verifyCronOrTestAuthorization,
} from "@/lib/cron/cron-auth";
import { runAutomationCycle } from "@/lib/automation-control-plane/scheduler";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const test = isTestModeRequest(request);
  const authError = verifyCronOrTestAuthorization(request, test);
  if (authError) return authError;

  try {
    const result = await runAutomationCycle({ trigger: "cron" });
    return NextResponse.json({
      ok: result.status === "SUCCESS" || result.status === "SKIPPED",
      test,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Background worker cron failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
