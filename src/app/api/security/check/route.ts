import { NextResponse } from "next/server";
import { runSecurityCheck } from "@/lib/security/security-check";

export async function POST() {
  try {
    return NextResponse.json({ ok: true, security: await runSecurityCheck(), sprint: "mvp-24" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
