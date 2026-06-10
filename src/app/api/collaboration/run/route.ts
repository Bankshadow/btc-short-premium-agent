import { NextResponse } from "next/server";
import { runCollaborationLoop } from "@/lib/collaboration/collaboration-runner";

export async function POST() {
  try {
    const summary = await runCollaborationLoop();
    return NextResponse.json({ ok: true, summary, sprint: "mvp-16" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Collaboration failed" },
      { status: 500 },
    );
  }
}
