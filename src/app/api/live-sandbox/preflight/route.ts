import { NextResponse } from "next/server";
import { runLiveSandboxPreflight } from "@/lib/live-sandbox/live-dry-run";

export async function POST() {
  try {
    return NextResponse.json({ ok: true, preflight: await runLiveSandboxPreflight(), sprint: "mvp-23" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
