import { NextResponse } from "next/server";
import { loadServerAnalysisJournal } from "@/lib/journal/journal-server-store";
import { getDeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import { runParallelAgentReview } from "@/lib/parallel-task-runner/run-parallel-review";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 76 — run parallel agent reviews + committee moderator. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      approveCursorPrompt?: boolean;
    };
    const entries = await loadServerAnalysisJournal().catch(() => []);
    const result = await runParallelAgentReview({
      entries,
      orders: [],
      riskProfile: getDeskRiskProfile(),
      approveCursorPrompt: body.approveCursorPrompt === true,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Parallel review failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
