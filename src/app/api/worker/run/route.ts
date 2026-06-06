import { runWorkerCycle } from "@/lib/background-worker/run-worker";
import { WORKER_SAFETY_NOTICE } from "@/lib/background-worker/config";
import type { WorkerRunInput } from "@/lib/background-worker/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    let body: WorkerRunInput = {};
    try {
      body = (await request.json()) as WorkerRunInput;
    } catch {
      /* empty body */
    }

    const result = await runWorkerCycle({
      ...body,
      trigger: body.trigger ?? "client",
    });

    return NextResponse.json({
      ok: result.status === "COMPLETED" || result.status === "SKIPPED",
      result,
      safetyNotice: WORKER_SAFETY_NOTICE,
      cannotPlaceLiveTrades: true,
      cannotApproveProposals: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Worker run failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
