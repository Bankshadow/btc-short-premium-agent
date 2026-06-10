import { NextResponse } from "next/server";
import { runCoreReplay } from "@/lib/core/core-engine";

export async function POST() {
  try {
    const report = await runCoreReplay();
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Replay failed" },
      { status: 500 },
    );
  }
}
