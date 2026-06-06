import { NextResponse } from "next/server";
import { SECOND_BRAIN_SAFETY_NOTICE } from "@/lib/second-brain/types";
import { getSecondBrainDashboardSnapshot } from "@/lib/second-brain/prepare-cycle";
import { buildSecondBrainGraphView } from "@/lib/second-brain/build-graph-view";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 74 — second brain snapshot and graph view. */
export async function GET() {
  try {
    const snapshot = await getSecondBrainDashboardSnapshot();
    const graph = buildSecondBrainGraphView({
      conscious: snapshot.state.conscious ?? snapshot.lastCycle?.conscious ?? null,
      memories: snapshot.state.memories,
      relevant: snapshot.lastCycle?.relevantLessons,
    });
    return NextResponse.json({
      ok: true,
      mvp: 74,
      safetyNotice: SECOND_BRAIN_SAFETY_NOTICE,
      summary: snapshot.summary,
      lastCycle: snapshot.lastCycle,
      graph,
      memoryCount: snapshot.state.memories.filter((m) => !m.superseded).length,
      lastConsolidatedAt: snapshot.state.lastConsolidatedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Second brain status failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
