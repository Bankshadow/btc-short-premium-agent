import { writeThroughRiskEvent } from "@/lib/db/write-through";
import { appendRiskEvent } from "@/lib/real-time-risk/risk-event-store";
import type { RealTimeRiskEvent, RiskCheckId } from "@/lib/real-time-risk/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  eventType: string;
  severity: RealTimeRiskEvent["severity"];
  message: string;
  checkId?: RiskCheckId;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body.eventType?.trim() || !body.message?.trim()) {
      return NextResponse.json(
        { error: "eventType and message required" },
        { status: 400 },
      );
    }

    const event = await appendRiskEvent({
      eventType: body.eventType.trim(),
      severity: body.severity ?? "info",
      message: body.message.trim(),
      checkId: body.checkId,
    });

    const wh = await writeThroughRiskEvent(event);

    return NextResponse.json({
      ok: true,
      event,
      warehouseWritten: wh.ok,
      warehouseErrors: wh.errors,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Risk event failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
