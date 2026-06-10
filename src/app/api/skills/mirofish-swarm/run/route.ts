import { NextResponse } from "next/server";
import { runMirofishSwarm } from "@/lib/skills/mirofish-swarm/swarm-runner";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { seedNote?: string };
    const result = await runMirofishSwarm({ seedNote: body.seedNote });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { ok: false, report: null, message: err instanceof Error ? err.message : "Swarm failed" },
      { status: 500 },
    );
  }
}
