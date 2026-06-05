import { listWarehouseRows } from "@/lib/db/repositories/warehouse-repository";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(200, Number(url.searchParams.get("limit") ?? 50));
    const kind = url.searchParams.get("kind") ?? "all";

    const paper =
      kind === "live" ? [] : await listWarehouseRows("paper_trades", limit);
    const live =
      kind === "paper" ? [] : await listWarehouseRows("live_trades", limit);

    return NextResponse.json({
      ok: true,
      paperTrades: paper.map((r) => r.payload),
      liveTrades: live.map((r) => r.payload),
      counts: { paper: paper.length, live: live.length },
      source: "warehouse",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Fetch trades failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
