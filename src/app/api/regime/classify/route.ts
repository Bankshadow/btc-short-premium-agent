import { NextResponse } from "next/server";
import { classifyAndStoreRegime } from "@/lib/regime/regime-retrieval";

export async function POST() {
  try {
    const regime = await classifyAndStoreRegime();
    return NextResponse.json({ ok: true, regime, sprint: "mvp-14" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Classify failed" },
      { status: 500 },
    );
  }
}
