import { NextResponse } from "next/server";
import { getLatestSwarmReport } from "@/lib/skills/mirofish-swarm/swarm-runner";

export async function GET() {
  try {
    const report = await getLatestSwarmReport();
    if (!report) {
      return NextResponse.json({ report: null, message: "No swarm report yet.", sprint: "mvp-11" });
    }
    return NextResponse.json({ report, sprint: "mvp-11" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load swarm report" },
      { status: 500 },
    );
  }
}
