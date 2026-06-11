import { NextResponse } from "next/server";
import { runProjectionParityCheck } from "@/lib/core/projection-parity";

export async function GET() {
  try {
    const report = await runProjectionParityCheck();
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      {
        status: "BLOCKED",
        error: err instanceof Error ? err.message : "Parity check failed",
        lastCheckedAt: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
