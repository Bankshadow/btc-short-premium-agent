import { loadWorkerHistory } from "@/lib/background-worker/state-store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const history = await loadWorkerHistory();
    return NextResponse.json({ ok: true, history });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Worker history failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
