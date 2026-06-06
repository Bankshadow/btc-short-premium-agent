import {
  getProjectStrategistSafetyNotice,
  runProjectStrategist,
} from "@/lib/project-strategist";
import type { ProjectStrategistRunInput } from "@/lib/project-strategist";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    let body: ProjectStrategistRunInput = {};
    try {
      body = (await request.json()) as ProjectStrategistRunInput;
    } catch {
      /* empty body */
    }
    const workspaceId =
      body.workspaceId ??
      request.headers.get("X-Workspace-Id") ??
      "server-default";

    const result = await runProjectStrategist({
      ...body,
      workspaceId,
      trigger: body.trigger ?? "manual",
    });
    return NextResponse.json({
      ok: true,
      result,
      safetyNotice: getProjectStrategistSafetyNotice(),
      cannotTrade: true,
      cannotChangeLiveSettings: true,
      cannotAutoMergeCode: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Strategist run failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
