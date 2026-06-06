import { NextResponse } from "next/server";
import { AGENT_OS_SAFETY_NOTICE } from "@/lib/agent-os";
import { loadPermissionAudit } from "@/lib/agent-os/audit-store";
// server-only store

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 71 — permission decision audit trail. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? "50");
    const events = await loadPermissionAudit(
      Number.isFinite(limit) ? Math.min(limit, 200) : 50,
    );

    return NextResponse.json({
      ok: true,
      mvp: 71,
      events,
      safetyNotice: AGENT_OS_SAFETY_NOTICE,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audit load failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
