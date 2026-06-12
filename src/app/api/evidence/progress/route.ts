import { NextResponse } from "next/server";
import { getEvidenceProgressView } from "@/lib/evidence/evidence-progress";

export async function GET() {
  try {
    const progress = await getEvidenceProgressView();
    return NextResponse.json({ ok: true, progress, liveLocked: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to load evidence progress" },
      { status: 500 },
    );
  }
}
