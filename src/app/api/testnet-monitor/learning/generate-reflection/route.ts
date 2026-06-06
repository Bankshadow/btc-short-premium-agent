import { NextResponse } from "next/server";
import { buildTestnetMonitorSnapshot } from "@/lib/testnet-monitor";
import { generateLearningReflectionServer } from "@/lib/testnet-monitor/learning-records-server";
import { recordMonitorEvent } from "@/lib/testnet-monitor/monitor-journal-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  learningRecordId?: string;
  notes?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body.learningRecordId) {
      return NextResponse.json(
        { ok: false, error: "learningRecordId required" },
        { status: 400 },
      );
    }

    const updated = await generateLearningReflectionServer({
      learningRecordId: body.learningRecordId,
      notes: body.notes,
    });
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "Learning record not found" },
        { status: 404 },
      );
    }

    await recordMonitorEvent({
      exchange: "BINANCE",
      environment: "TESTNET",
      eventType: "LEARNING_UPDATED",
      symbol: updated.symbol,
      payload: {
        learningRecordId: updated.learningRecordId,
        closedTradeId: updated.closedTradeId,
        status: updated.status,
      },
      decisionLogId: updated.decisionLogId,
      orderId: updated.orderId,
      positionId: updated.positionId,
    });

    const snapshot = await buildTestnetMonitorSnapshot();
    return NextResponse.json({ ok: true, updated, snapshot });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Generate reflection failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
