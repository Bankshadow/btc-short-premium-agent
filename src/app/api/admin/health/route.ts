import { buildObservabilitySnapshot } from "@/lib/observability";
import {
  appendObservabilityUsage,
  loadObservabilityIncidents,
  loadObservabilityUsage,
} from "@/lib/observability/store";
import { parseApiWorkspaceContext } from "@/lib/platform/api-context";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const wsCtx = parseApiWorkspaceContext(request, {});
    const workspaceId = wsCtx.workspaceId ?? "server-default";
    const report = await buildObservabilitySnapshot(workspaceId, {
      promoteIncidents: true,
    });
    const incidents = await loadObservabilityIncidents();
    const usage = await loadObservabilityUsage();

    await appendObservabilityUsage({
      workspaceId,
      action: "ADMIN_VIEW_HEALTH",
      userRole: wsCtx.role ?? "ADMIN",
    });

    return NextResponse.json({
      ok: true,
      report,
      incidents,
      usage: usage.slice(0, 50),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Health snapshot failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
