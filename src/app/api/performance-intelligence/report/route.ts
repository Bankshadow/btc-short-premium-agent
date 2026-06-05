import { buildPerformanceIntelligenceReport } from "@/lib/performance-intelligence/build-performance-report";
import type { PerformanceIntelligenceInput } from "@/lib/performance-intelligence/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PerformanceIntelligenceInput;
    const report = buildPerformanceIntelligenceReport(body);
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Report failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
