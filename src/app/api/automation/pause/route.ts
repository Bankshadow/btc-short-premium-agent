import { pauseAutomation } from "@/lib/automation-control-plane/scheduler";
import { patchAutomationSettings } from "@/lib/automation-control-plane/state-store";
import { invalidateMissionSnapshotCache } from "@/lib/mission-flow/build-server-snapshot";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      paused?: boolean;
      automationEnabled?: boolean;
      intervalMinutes?: number;
      moduleToggles?: Record<string, boolean>;
      workspaceId?: string;
    };
    const workspaceId =
      body.workspaceId ??
      request.headers.get("X-Workspace-Id") ??
      "server-default";

    if (typeof body.paused === "boolean") {
      await pauseAutomation(body.paused, workspaceId);
    }

    const settings = await patchAutomationSettings(
      {
        automationEnabled: body.automationEnabled,
        intervalMinutes: body.intervalMinutes,
        moduleToggles: body.moduleToggles as never,
      },
      workspaceId,
    );

    invalidateMissionSnapshotCache();
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pause failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
