import { NextResponse } from "next/server";
import { getLatestBriefing } from "@/lib/briefing/daily-briefing";

export async function GET() {
  try {
    return NextResponse.json({ briefing: await getLatestBriefing(), sprint: "mvp-20" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
