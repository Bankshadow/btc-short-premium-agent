import { loadObservabilityErrors } from "@/lib/observability/store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const errors = await loadObservabilityErrors();
    return NextResponse.json({ ok: true, errors });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Load errors failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
