import { NextResponse } from "next/server";
import { processPnlCalculation } from "@/lib/pnl/pnl-engine";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { tradeId?: string; positionId?: string };
    if (!body.tradeId && !body.positionId) {
      return NextResponse.json(
        { ok: false, error: "tradeId or positionId is required" },
        { status: 400 },
      );
    }

    const result = await processPnlCalculation({
      tradeId: body.tradeId,
      positionId: body.positionId,
    });

    const statusCode =
      result.status === "BLOCKED" ? 403 : result.ok || result.status === "PENDING_DATA" ? 200 : 422;

    return NextResponse.json(
      {
        ok: result.ok || result.status === "PENDING_DATA",
        status: result.status,
        tradeId: result.tradeId,
        positionId: result.positionId,
        pnl: result.pnl,
        reasons: result.reasons,
        warnings: result.warnings,
        message: result.message,
        eventsWritten: result.eventsWritten,
        alreadyRealized: result.alreadyRealized ?? false,
      },
      { status: statusCode },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "PnL calculation failed" },
      { status: 500 },
    );
  }
}
