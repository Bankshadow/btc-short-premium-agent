import { NextResponse } from "next/server";
import { getEvidenceProgressView } from "@/lib/evidence/evidence-progress";

export async function GET() {
  try {
    const progress = await getEvidenceProgressView();
    return NextResponse.json({ trades: progress.trades, sprint: "mvp-8" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load evidence trades" },
      { status: 500 },
    );
  }
}
