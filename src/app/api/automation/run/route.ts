import { runAutomationCycle } from "@/lib/automation-control-plane/scheduler";
import { AUTOMATION_SAFETY_NOTICE } from "@/lib/automation-control-plane/config";
import type { AutomationRunInput } from "@/lib/automation-control-plane/types";
import { invalidateMissionSnapshotCache } from "@/lib/mission-flow/build-server-snapshot";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    let body: AutomationRunInput = {};
    try {
      body = (await request.json()) as AutomationRunInput;
    } catch {
      /* empty body */
    }

    const workspaceId =
      body.workspaceId ??
      request.headers.get("X-Workspace-Id") ??
      "server-default";

    const result = await runAutomationCycle({
      ...body,
      workspaceId,
      trigger: body.trigger ?? "manual",
    });

    invalidateMissionSnapshotCache();
    return NextResponse.json({
      ok: result.status === "SUCCESS" || result.status === "SKIPPED",
      result,
      safetyNotice: AUTOMATION_SAFETY_NOTICE,
      cannotApproveLiveTrades: true,
      cannotIncreaseRisk: true,
      cannotDisableKillSwitch: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Automation run failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
