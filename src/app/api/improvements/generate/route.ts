import { NextResponse } from "next/server";
import { generateImprovementProposals } from "@/lib/improvement/proposal-generator";

export async function POST() {
  try {
    const proposals = await generateImprovementProposals();
    return NextResponse.json({ ok: true, proposals, sprint: "mvp-17" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generate failed" },
      { status: 500 },
    );
  }
}
