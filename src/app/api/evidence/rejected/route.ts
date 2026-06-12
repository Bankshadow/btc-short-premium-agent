import { NextResponse } from "next/server";
import { getEvidenceProgressView } from "@/lib/evidence/evidence-progress";

export async function GET() {
  try {
    const progress = await getEvidenceProgressView();
    return NextResponse.json({
      ok: true,
      count: progress.rejectedList.length,
      trades: progress.rejectedList.map((t) => ({
        tradeId: t.tradeId,
        positionId: t.positionId,
        symbol: t.symbol,
        status: t.status,
        rejectedReasons: t.rejectedReasons,
        missingEvents: t.missingEvents,
        message: t.rejectedReasons.join(", "),
        validatedAt: t.validatedAt,
      })),
      liveLocked: true,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to load rejected evidence trades" },
      { status: 500 },
    );
  }
}
