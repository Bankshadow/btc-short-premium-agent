import {
  getProjectStrategistSafetyNotice,
  pasteProjectStrategistSource,
} from "@/lib/project-strategist";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      workspaceId?: string;
      sourceUrl?: string | null;
      title?: string;
      sourceContent?: string;
    };
    if (!body.sourceContent?.trim()) {
      return NextResponse.json(
        { ok: false, error: "sourceContent required" },
        { status: 400 },
      );
    }
    const workspaceId =
      body.workspaceId ??
      request.headers.get("X-Workspace-Id") ??
      "server-default";
    const snapshot = await pasteProjectStrategistSource({
      workspaceId,
      sourceUrl: body.sourceUrl ?? null,
      title: body.title?.trim(),
      sourceContent: body.sourceContent.trim(),
    });
    return NextResponse.json({
      ok: true,
      snapshot,
      safetyNotice: getProjectStrategistSafetyNotice(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Paste source failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
