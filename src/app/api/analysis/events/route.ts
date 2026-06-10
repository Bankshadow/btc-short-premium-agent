import { NextResponse } from "next/server";
import { queryEngineEvents } from "@/lib/engine-event-bus/engine-event-bus";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitRaw = Number(searchParams.get("limit") ?? "50");
    const limit = Number.isFinite(limitRaw)
      ? Math.min(200, Math.max(1, limitRaw))
      : 50;

    const { events, total } = await queryEngineEvents({
      limit,
      runId: searchParams.get("runId"),
      decisionLogId: searchParams.get("decisionLogId"),
      tradeId: searchParams.get("tradeId"),
      meaningfulOnly: searchParams.get("meaningful") === "1",
      since: searchParams.get("since"),
    });

    return NextResponse.json({
      ok: true,
      mvp: 85,
      label: "Engine Event Bus",
      events,
      total,
      liveTradingLocked: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Analysis events failed",
      },
      { status: 500 },
    );
  }
}
