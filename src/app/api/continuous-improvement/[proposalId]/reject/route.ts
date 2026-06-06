import { NextResponse } from "next/server";
import { rejectImprovementProposal } from "@/lib/continuous-improvement-loop/run-detect-cycle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ proposalId: string }> },
) {
  try {
    const { proposalId } = await context.params;
    const proposal = await rejectImprovementProposal(proposalId);
    if (!proposal) {
      return NextResponse.json({ ok: false, error: "Proposal not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, proposal });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reject failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
