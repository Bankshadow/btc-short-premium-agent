import { NextResponse } from "next/server";
import { getLatestCollaboration } from "@/lib/collaboration/collaboration-runner";

export async function GET() {
  try {
    const summary = await getLatestCollaboration();
    return NextResponse.json({ summary, sprint: "mvp-16" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load collaboration" },
      { status: 500 },
    );
  }
}
