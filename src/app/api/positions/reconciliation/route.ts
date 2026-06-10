import { NextResponse } from "next/server";
import { getReconciliationStatus } from "@/lib/positions/position-monitor";

export async function GET() {
  try {
    const reconciliation = await getReconciliationStatus();
    return NextResponse.json({ reconciliation, sprint: "mvp-5" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load reconciliation" },
      { status: 500 },
    );
  }
}
