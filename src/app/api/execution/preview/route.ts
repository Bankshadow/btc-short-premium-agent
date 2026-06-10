import { NextRequest, NextResponse } from "next/server";
import { createTestnetPreview } from "@/lib/execution/create-preview";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      runId?: string;
      decisionLogId?: string;
      symbol?: string;
      side?: "BUY" | "SELL";
      notionalUsd?: number;
    };

    if (!body.runId || !body.decisionLogId) {
      return NextResponse.json(
        { error: "runId and decisionLogId are required" },
        { status: 400 },
      );
    }

    const result = await createTestnetPreview({
      runId: body.runId,
      decisionLogId: body.decisionLogId,
      symbol: body.symbol,
      side: body.side,
      notionalUsd: body.notionalUsd,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          blockReasons: result.blockReasons,
          eventType: result.eventType,
        },
        { status: 403 },
      );
    }

    return NextResponse.json({
      ok: true,
      preview: result.preview,
      eventType: result.eventType,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Preview creation failed" },
      { status: 500 },
    );
  }
}
