import { NextResponse } from "next/server";
import { buildOneButtonAiStatus } from "@/lib/one-button-ai-mode/build-status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const status = await buildOneButtonAiStatus();
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "One Button AI status failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
