import { retryFailedWorkerJob } from "@/lib/background-worker/run-worker";
import { WORKER_SAFETY_NOTICE } from "@/lib/background-worker/config";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { failedJobId?: string };
    if (!body.failedJobId?.trim()) {
      return NextResponse.json(
        { ok: false, error: "failedJobId required" },
        { status: 400 },
      );
    }

    const result = await retryFailedWorkerJob(body.failedJobId);
    if (!result) {
      return NextResponse.json(
        { ok: false, error: "Failed job not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: result.status === "COMPLETED",
      result,
      safetyNotice: WORKER_SAFETY_NOTICE,
      cannotPlaceLiveTrades: true,
      cannotApproveProposals: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Worker retry failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
