import { AGENT_ROSTER_SUMMARY } from "@/lib/agents/agent-roster";
import {
  loadCronConfigSnapshot,
  runCronTick,
} from "@/lib/automation-control-plane/run-cron-tick";
import {
  normalizeCronIntervalMinutes,
  describeCronSchedule,
} from "@/lib/automation-control-plane/cron-config";
import { patchAutomationSettings } from "@/lib/automation-control-plane/state-store";
import { invalidateMissionSnapshotCache } from "@/lib/mission-flow/build-server-snapshot";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const config = await loadCronConfigSnapshot();
    return NextResponse.json({
      ok: true,
      config,
      agents: AGENT_ROSTER_SUMMARY,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron config load failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      intervalMinutes?: number;
      automationEnabled?: boolean;
      paused?: boolean;
      workspaceId?: string;
    };
    const workspaceId =
      body.workspaceId ??
      request.headers.get("X-Workspace-Id") ??
      "server-default";

    const intervalMinutes =
      body.intervalMinutes !== undefined
        ? normalizeCronIntervalMinutes(body.intervalMinutes)
        : undefined;

    const settings = await patchAutomationSettings(
      {
        intervalMinutes,
        automationEnabled: body.automationEnabled,
        paused: body.paused,
      },
      workspaceId,
    );

    invalidateMissionSnapshotCache();
    const config = await loadCronConfigSnapshot(workspaceId);

    return NextResponse.json({
      ok: true,
      settings,
      config,
      scheduleNotes: describeCronSchedule(settings.intervalMinutes),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron config update failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let body: { force?: boolean; workspaceId?: string } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      /* empty */
    }
    const workspaceId =
      body.workspaceId ??
      request.headers.get("X-Workspace-Id") ??
      "server-default";
    const tick = await runCronTick({ workspaceId, force: body.force === true });
    return NextResponse.json({ ok: tick.ok, tick });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron tick failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
