import { buildExchangeStatus } from "@/lib/exchange/build-exchange-status";
import { liveExecutionStatus } from "@/lib/exchange/live-execution-gate";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const status = await buildExchangeStatus();
    return NextResponse.json({
      ...status,
      liveExecution: liveExecutionStatus(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Exchange status failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
