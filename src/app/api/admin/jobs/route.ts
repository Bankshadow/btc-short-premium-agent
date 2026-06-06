import {
  getAutomationStatus,
  loadAutomationHistory,
} from "@/lib/automation-control-plane";
import { loadFailedAutomationJobs } from "@/lib/automation-control-plane/state-store";
import type { AdminJobsSnapshot } from "@/lib/observability/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const workspaceId = "server-default";
    const [status, history, failedJobs] = await Promise.all([
      getAutomationStatus(workspaceId),
      loadAutomationHistory(),
      loadFailedAutomationJobs(),
    ]);

    const snapshot: AdminJobsSnapshot = {
      generatedAt: new Date().toISOString(),
      workspaceId,
      failedJobs,
      recentRuns: history.slice(0, 15),
      activeJobs: status.activeJobs,
    };

    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Jobs snapshot failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
