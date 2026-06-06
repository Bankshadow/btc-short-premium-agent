import { NextResponse } from "next/server";
import { runOneButtonAiAction } from "@/lib/one-button-ai-mode/run-action";
import type { OneButtonAiAction } from "@/lib/one-button-ai-mode/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: OneButtonAiAction;
      workspaceId?: string;
    };
    const workspaceId =
      body.workspaceId ??
      request.headers.get("X-Workspace-Id") ??
      "server-default";

    const result = await runOneButtonAiAction(workspaceId, body.action);
    const status = result.ok ? 200 : 422;
    return NextResponse.json(result, { status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "One Button AI run failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
