import { NextResponse } from "next/server";
import { PARALLEL_TASK_RUNNER_SAFETY_NOTICE } from "@/lib/parallel-task-runner/types";
import { getParallelTaskRunnerSnapshot } from "@/lib/parallel-task-runner/run-parallel-review";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 76 — parallel agent review snapshot. */
export async function GET() {
  try {
    const snapshot = await getParallelTaskRunnerSnapshot();
    return NextResponse.json({
      ok: true,
      mvp: 76,
      safetyNotice: PARALLEL_TASK_RUNNER_SAFETY_NOTICE,
      ...snapshot,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Parallel runner status failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
