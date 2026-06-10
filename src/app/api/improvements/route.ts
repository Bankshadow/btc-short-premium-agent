import { NextResponse } from "next/server";
import { getAllImprovementProposals } from "@/lib/improvement/proposal-generator";

export async function GET() {
  try {
    const proposals = await getAllImprovementProposals();
    return NextResponse.json({ proposals, sprint: "mvp-17" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load improvements" },
      { status: 500 },
    );
  }
}
