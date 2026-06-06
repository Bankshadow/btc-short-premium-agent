import { retryAutomationJob } from "@/lib/automation-control-plane/scheduler";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { failedJobId?: string };
    if (!body.failedJobId) {
      return NextResponse.json(
        { ok: false, error: "failedJobId required" },
        { status: 400 },
      );
    }
    const result = await retryAutomationJob(body.failedJobId);
    if (!result) {
      return NextResponse.json(
        { ok: false, error: "Failed job not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: result.status !== "FAILED", result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Retry failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
