import { NextResponse } from "next/server";
import { getLatestRegimeClassification } from "@/lib/regime/regime-retrieval";

export async function GET() {
  try {
    const regime = await getLatestRegimeClassification();
    return NextResponse.json({ regime, sprint: "mvp-14" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load regime" },
      { status: 500 },
    );
  }
}
