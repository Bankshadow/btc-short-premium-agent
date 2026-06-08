import { buildCronHealthSnapshot } from "@/lib/automation-control-plane/cron-health";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const health = await buildCronHealthSnapshot();
    return NextResponse.json({ ok: true, health });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron health check failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
