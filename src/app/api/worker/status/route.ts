import { WORKER_SAFETY_NOTICE } from "@/lib/background-worker/config";
import { loadFailedWorkerJobs, loadWorkerState } from "@/lib/background-worker/state-store";
import { evaluateServerBackboneHealth } from "@/lib/background-worker/server-backbone";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const state = await loadWorkerState();
    const failed = await loadFailedWorkerJobs();
    const backbone = await evaluateServerBackboneHealth();

    return NextResponse.json({
      ok: true,
      state: {
        lock: state.lock,
        settings: state.settings,
        lastRun: state.lastRun,
        lastSuccessfulRunAt: state.lastSuccessfulRunAt,
        nextRunAt: state.nextRunAt,
      },
      failedJobs: failed,
      backboneHealthy: backbone.healthy,
      backboneHealth: backbone.health,
      safetyNotice: WORKER_SAFETY_NOTICE,
      cannotPlaceLiveTrades: true,
      cannotApproveProposals: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Worker status failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
