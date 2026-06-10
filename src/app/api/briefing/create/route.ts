import { NextResponse } from "next/server";
import { createDailyBriefing } from "@/lib/briefing/daily-briefing";

export async function POST() {
  try {
    const briefing = await createDailyBriefing();
    return NextResponse.json({ ok: true, briefing, sprint: "mvp-20" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
