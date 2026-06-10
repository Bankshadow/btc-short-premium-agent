import { NextResponse } from "next/server";
import { getEvents } from "@/lib/journal/journal-query";
import type { ScenarioSwarmReport } from "@/lib/skills/mirofish-swarm/swarm-types";

export async function GET() {
  try {
    const events = await getEvents();
    const reports = events
      .filter((e) => e.type === "MIROFISH_SCENARIO_REPORT_CREATED")
      .map((e) => e.payload as unknown as ScenarioSwarmReport);
    return NextResponse.json({ reports, sprint: "mvp-11" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load swarm reports" },
      { status: 500 },
    );
  }
}
