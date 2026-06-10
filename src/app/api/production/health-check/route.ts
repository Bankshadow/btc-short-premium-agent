import { NextResponse } from "next/server";
import { runProductionHealthCheck } from "@/lib/production/production-health-check";

export async function POST() {
  try {
    return NextResponse.json({ ok: true, health: await runProductionHealthCheck(), sprint: "mvp-24" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
