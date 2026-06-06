import {
  createObservabilityIncident,
  loadObservabilityIncidents,
  updateObservabilityIncident,
} from "@/lib/observability/store";
import type { IncidentSeverity, IncidentStatus, IncidentType } from "@/lib/governance/governance-types";
import { parseApiWorkspaceContext } from "@/lib/platform/api-context";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const incidents = await loadObservabilityIncidents();
  return NextResponse.json({ ok: true, incidents });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: "create" | "update";
      workspaceId?: string;
      type?: IncidentType;
      severity?: IncidentSeverity;
      description?: string;
      rootCause?: string;
      correctiveAction?: string;
      incidentId?: string;
      status?: IncidentStatus;
      resolutionNote?: string;
      links?: {
        jobId?: string;
        failedJobId?: string;
        errorId?: string;
        policyRecordId?: string;
        runId?: string;
      };
    };

    const wsCtx = parseApiWorkspaceContext(request, body as Record<string, unknown>);
    const workspaceId = body.workspaceId ?? wsCtx.workspaceId ?? "server-default";

    if (body.action === "update" && body.incidentId) {
      const updated = await updateObservabilityIncident(body.incidentId, {
        status: body.status,
        resolutionNote: body.resolutionNote,
        correctiveAction: body.correctiveAction,
        rootCause: body.rootCause,
        description: body.description,
        severity: body.severity,
      });
      if (!updated) {
        return NextResponse.json({ ok: false, error: "Incident not found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, incident: updated });
    }

    if (!body.description || !body.type || !body.severity) {
      return NextResponse.json(
        { ok: false, error: "description, type, and severity required" },
        { status: 400 },
      );
    }

    const incident = await createObservabilityIncident({
      workspaceId,
      type: body.type,
      severity: body.severity,
      description: body.description,
      rootCause: body.rootCause,
      correctiveAction: body.correctiveAction,
      autoCreated: false,
      links: body.links,
    });

    return NextResponse.json({ ok: true, incident });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Incident API failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
