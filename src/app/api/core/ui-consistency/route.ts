import { NextResponse } from "next/server";
import { runUiConsistencyCheck } from "@/lib/core/ui-consistency-check";

export async function GET() {
  try {
    const report = await runUiConsistencyCheck();
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      {
        status: "BLOCKED",
        checks: [],
        mismatches: [
          {
            id: "ui_consistency_failed",
            ok: false,
            message: err instanceof Error ? err.message : "Consistency check failed",
          },
        ],
        lastCheckedAt: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
