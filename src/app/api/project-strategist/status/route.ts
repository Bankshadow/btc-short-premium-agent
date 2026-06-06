import {
  getProjectStrategistSafetyNotice,
  getProjectStrategistStatus,
} from "@/lib/project-strategist";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const workspaceId =
      request.headers.get("X-Workspace-Id") ?? "server-default";
    const snapshot = await getProjectStrategistStatus(workspaceId);
    return NextResponse.json({
      ok: true,
      snapshot,
      safetyNotice: getProjectStrategistSafetyNotice(),
      cannotTrade: true,
      cannotChangeLiveSettings: true,
      cannotAutoMergeCode: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Status load failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
