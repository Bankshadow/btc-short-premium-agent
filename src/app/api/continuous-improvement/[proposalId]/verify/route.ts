import { NextResponse } from "next/server";
import { verifyImprovementProposal } from "@/lib/continuous-improvement-loop/run-detect-cycle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ proposalId: string }> },
) {
  try {
    const { proposalId } = await context.params;
    const proposal = await verifyImprovementProposal(proposalId);
    if (!proposal) {
      return NextResponse.json(
        { ok: false, error: "Proposal must be IMPLEMENTED before verify" },
        { status: 400 },
      );
    }
    return NextResponse.json({
      ok: true,
      proposal,
      verificationPassed: proposal.verificationPassed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verify failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
