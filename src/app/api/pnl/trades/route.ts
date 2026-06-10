import { NextResponse } from "next/server";
import { getAllPnlRecords, buildPnlSummary } from "@/lib/pnl/pnl-store";

export async function GET() {
  try {
    const records = await getAllPnlRecords();
    return NextResponse.json({ records, summary: buildPnlSummary(records), sprint: "mvp-6" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load PnL trades" },
      { status: 500 },
    );
  }
}
