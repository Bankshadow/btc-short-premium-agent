import { NextResponse } from "next/server";
import { recalculateAgentScoreboard } from "@/lib/agents/agent-scoreboard";

export async function POST() {
  try {
    const scoreboard = await recalculateAgentScoreboard();
    return NextResponse.json({ ok: true, scoreboard, sprint: "mvp-13" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Recalculate failed" },
      { status: 500 },
    );
  }
}
