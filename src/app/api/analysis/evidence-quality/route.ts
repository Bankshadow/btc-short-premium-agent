import { NextResponse } from "next/server";
import { buildEvidenceQualityServerSnapshot } from "@/lib/evidence-quality/build-evidence-quality-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await buildEvidenceQualityServerSnapshot();
    return NextResponse.json({
      ok: true,
      snapshot,
      liveTradingLocked: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Evidence quality check failed",
      },
      { status: 500 },
    );
  }
}
