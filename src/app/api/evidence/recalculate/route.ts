import { NextResponse } from "next/server";
import { recalculateEvidenceProgress } from "@/lib/evidence/evidence-progress";

export async function POST() {
  try {
    const progress = await recalculateEvidenceProgress();
    return NextResponse.json(progress);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Evidence recalculate failed" },
      { status: 500 },
    );
  }
}
