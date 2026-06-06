import {
  loadAnomalyIncidents,
  runAnomalyDetectionSnapshot,
  updateAnomalyIncident,
} from "@/lib/anomaly-detection";
import type { AnomalyIncidentStatus, IncidentActor } from "@/lib/anomaly-detection";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  action?: "detect" | "update";
  incidentId?: string;
  status?: AnomalyIncidentStatus;
  resolutionNote?: string | null;
  actor?: IncidentActor;
};

export async function GET() {
  try {
    const summary = await runAnomalyDetectionSnapshot({
      persist: true,
      useCache: false,
    });
    return NextResponse.json({
      ok: true,
      summary,
      incidents: summary.incidents,
      blocksRiskyActions: summary.blocksRiskyActions,
      safetyNotice:
        "CRITICAL incidents block new testnet/live actions. AI cannot auto-resolve CRITICAL incidents.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "incidents-v2 fetch failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (body.action === "update") {
      if (!body.incidentId) {
        return NextResponse.json({ ok: false, error: "incidentId required" }, { status: 400 });
      }
      const updated = await updateAnomalyIncident(body.incidentId, {
        status: body.status,
        resolutionNote: body.resolutionNote,
        actor: body.actor,
      });
      if (!updated) {
        return NextResponse.json({ ok: false, error: "incident not found" }, { status: 404 });
      }
      const incidents = await loadAnomalyIncidents();
      return NextResponse.json({ ok: true, incident: updated, incidents });
    }

    const summary = await runAnomalyDetectionSnapshot({
      persist: true,
      useCache: false,
    });
    return NextResponse.json({ ok: true, summary, incidents: summary.incidents });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "incidents-v2 update failed";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
