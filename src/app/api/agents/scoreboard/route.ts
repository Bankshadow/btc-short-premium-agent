import { NextResponse } from "next/server";
import { buildAgentScoreboardView } from "@/lib/agents/agent-scoreboard";

export async function GET() {
  try {
    const scoreboard = await buildAgentScoreboardView();
    return NextResponse.json({ ...scoreboard, sprint: "mvp-13" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load scoreboard" },
      { status: 500 },
    );
  }
}
