import { buildWarehouseSnapshot } from "@/lib/db/warehouse-status";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const localCounts = {
      decisionLogs: Number(url.searchParams.get("decisionLogs") ?? 0),
      paperTrades: Number(url.searchParams.get("paperTrades") ?? 0),
      liveTrades: Number(url.searchParams.get("liveTrades") ?? 0),
    };
    const snapshot = await buildWarehouseSnapshot(localCounts);
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Warehouse snapshot failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
