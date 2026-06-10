import { NextResponse } from "next/server";
import { getStrategyVersionSnapshot } from "@/lib/versioning/strategy-version-store";

export async function GET() {
  try {
    const snapshot = await getStrategyVersionSnapshot();
    return NextResponse.json({ ...snapshot, sprint: "mvp-18" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load versions" },
      { status: 500 },
    );
  }
}
