import { NextResponse } from "next/server";
import { getLiveSandboxStatus } from "@/lib/live-sandbox/live-dry-run";

export async function GET() {
  try {
    return NextResponse.json({ ...(await getLiveSandboxStatus()), sprint: "mvp-23" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
