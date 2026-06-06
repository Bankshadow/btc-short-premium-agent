import {
  getProjectStrategistSafetyNotice,
  rejectProjectStrategistSkill,
} from "@/lib/project-strategist";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      workspaceId?: string;
      skillId?: string;
      reason?: string | null;
    };
    if (!body.skillId?.trim()) {
      return NextResponse.json(
        { ok: false, error: "skillId required" },
        { status: 400 },
      );
    }
    const workspaceId =
      body.workspaceId ??
      request.headers.get("X-Workspace-Id") ??
      "server-default";
    const snapshot = await rejectProjectStrategistSkill({
      workspaceId,
      skillId: body.skillId.trim(),
      reason: body.reason ?? null,
    });
    return NextResponse.json({
      ok: true,
      snapshot,
      safetyNotice: getProjectStrategistSafetyNotice(),
      humanApprovalRequired: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reject skill failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
