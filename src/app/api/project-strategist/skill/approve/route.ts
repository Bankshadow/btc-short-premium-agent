import {
  approveProjectStrategistSkill,
  getProjectStrategistSafetyNotice,
} from "@/lib/project-strategist";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      workspaceId?: string;
      skillId?: string;
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
    const snapshot = await approveProjectStrategistSkill({
      workspaceId,
      skillId: body.skillId.trim(),
    });
    return NextResponse.json({
      ok: true,
      snapshot,
      safetyNotice: getProjectStrategistSafetyNotice(),
      humanApprovalRequired: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Approve skill failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
