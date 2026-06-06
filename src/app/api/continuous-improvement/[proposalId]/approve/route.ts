import { NextResponse } from "next/server";
import { approveImprovementProposal } from "@/lib/continuous-improvement-loop/run-detect-cycle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ proposalId: string }> },
) {
  try {
    const { proposalId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { approvedBy?: string };
    const proposal = await approveImprovementProposal(
      proposalId,
      body.approvedBy ?? "operator",
    );
    if (!proposal) {
      return NextResponse.json(
        { ok: false, error: "Proposal not approvable" },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, proposal });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Approve failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
