import {
  loadAutomationHistory,
  loadFailedAutomationJobs,
} from "@/lib/automation-control-plane/state-store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 50));
    const history = await loadAutomationHistory();
    const failed = await loadFailedAutomationJobs();
    const recentJobs = history.flatMap((run) => run.jobs).slice(0, limit);

    return NextResponse.json({
      ok: true,
      history: history.slice(0, limit),
      recentJobs,
      failedJobs: failed,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Jobs load failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
