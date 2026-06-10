import { NextResponse } from "next/server";
import { createSessionReplay, listReplaySessions } from "@/lib/replay/session-replay";

export async function GET() {
  try {
    const sessions = await listReplaySessions();
    return NextResponse.json({ sessions, sprint: "mvp-20" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { tradeId?: string };
    const session = await createSessionReplay(body.tradeId);
    return NextResponse.json({ ok: true, session, sprint: "mvp-20" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
