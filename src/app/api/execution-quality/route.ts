import { NextResponse } from "next/server";
import { buildExecutionQualitySummary } from "@/lib/execution-quality";
import { buildExecutionQualityInputServer } from "@/lib/execution-quality/build-server-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const input = await buildExecutionQualityInputServer();
    const summary = buildExecutionQualitySummary(input);
    return NextResponse.json({
      ok: true,
      summary,
      safety: {
        monitorOnly: true,
        cannotExecuteOrders: true,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Execution quality failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

