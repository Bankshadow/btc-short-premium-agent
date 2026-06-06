import { NextResponse } from "next/server";
import { buildLiveEvidenceReport } from "@/lib/live-evidence";
import { buildServerLiveEvidenceInput } from "@/lib/live-evidence/build-server-evidence-input";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const input = await buildServerLiveEvidenceInput();
    const report = buildLiveEvidenceReport(input);
    return NextResponse.json({
      ok: true,
      report,
      safety: {
        cannotEnableLive: true,
        recommendationOnly: true,
        separateApprovalRequired: true,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Live evidence failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
