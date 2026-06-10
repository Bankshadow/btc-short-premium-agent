import { NextResponse } from "next/server";
import { evaluateMicroLiveReadiness } from "@/lib/live-readiness/readiness-evaluator";

export async function POST() {
  try {
    return NextResponse.json({ ok: true, report: await evaluateMicroLiveReadiness(), sprint: "mvp-22" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
