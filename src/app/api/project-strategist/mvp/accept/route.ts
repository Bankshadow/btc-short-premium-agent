import {
  getProjectStrategistSafetyNotice,
  markProjectStrategistMvp,
} from "@/lib/project-strategist";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      workspaceId?: string;
      mvpId?: string;
    };
    if (!body.mvpId?.trim()) {
      return NextResponse.json(
        { ok: false, error: "mvpId required" },
        { status: 400 },
      );
    }
    const workspaceId =
      body.workspaceId ??
      request.headers.get("X-Workspace-Id") ??
      "server-default";
    const snapshot = await markProjectStrategistMvp({
      workspaceId,
      mvpId: body.mvpId.trim(),
      status: "ACCEPTED",
    });
    return NextResponse.json({
      ok: true,
      snapshot,
      safetyNotice: getProjectStrategistSafetyNotice(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Accept MVP failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
