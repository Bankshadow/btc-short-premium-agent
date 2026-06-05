import {
  isTestModeRequest,
  verifyCronOrTestAuthorization,
} from "@/lib/cron/cron-auth";
import { runDeskAutomation } from "@/lib/automation/run-desk-automation";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const test = isTestModeRequest(request);
  const authError = verifyCronOrTestAuthorization(request, test);
  if (authError) return authError;

  try {
    const result = await runDeskAutomation({
      topic: "Scheduled desk automation — server cycle",
    });

    return NextResponse.json({
      ok: true,
      test,
      runId: result.runId,
      summary: result.summary,
      actionCount: result.actions.length,
      aiBrief: result.aiBrief,
      modules: result.meta,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Cron automation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
