import { NextResponse } from "next/server";
import { buildEvidenceQualityActivationStatus } from "@/lib/testnet-engine-activation/build-evidence-quality-status";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET() {
  try {
    const status = await buildEvidenceQualityActivationStatus();
    return NextResponse.json({ ok: true, ...status });
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
