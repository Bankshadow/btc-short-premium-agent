import { NextResponse } from "next/server";
import { refreshOpenPositions } from "@/lib/positions/position-monitor";

export async function POST() {
  try {
    const result = await refreshOpenPositions();
    return NextResponse.json({ ...result, sprint: "mvp-5" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to refresh positions" },
      { status: 500 },
    );
  }
}
