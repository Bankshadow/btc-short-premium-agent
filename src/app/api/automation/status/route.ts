import { getAutomationStatus } from "@/lib/automation-control-plane/scheduler";
import { AUTOMATION_SAFETY_NOTICE } from "@/lib/automation-control-plane/config";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const workspaceId =
      request.headers.get("X-Workspace-Id") ?? "server-default";
    const snapshot = await getAutomationStatus(workspaceId);
    return NextResponse.json({
      ok: true,
      snapshot,
      safetyNotice: AUTOMATION_SAFETY_NOTICE,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Status load failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
