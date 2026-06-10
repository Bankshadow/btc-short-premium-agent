import { NextResponse } from "next/server";
import { evaluateCoreHealth } from "@/lib/core/core-health";

export async function GET() {
  try {
    const report = await evaluateCoreHealth();
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      {
        status: "BLOCKED",
        message: err instanceof Error ? err.message : "Core health check failed",
        liveLocked: true,
      },
      { status: 200 },
    );
  }
}
