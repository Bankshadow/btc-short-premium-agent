import { NextResponse } from "next/server";
import { buildMicroLiveReadinessView } from "@/lib/live-readiness/readiness-evaluator";

export async function GET() {
  try {
    return NextResponse.json({ report: await buildMicroLiveReadinessView(), sprint: "mvp-22" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
