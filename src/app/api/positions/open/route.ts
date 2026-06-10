import { NextResponse } from "next/server";
import { getOpenPositionsView } from "@/lib/positions/position-monitor";

export async function GET() {
  try {
    const result = await getOpenPositionsView();
    return NextResponse.json({ ...result, sprint: "mvp-5" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load open positions" },
      { status: 500 },
    );
  }
}
