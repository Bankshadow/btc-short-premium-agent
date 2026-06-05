import { listWarehouseRows } from "@/lib/db/repositories/warehouse-repository";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(200, Number(url.searchParams.get("limit") ?? 50));
    const rows = await listWarehouseRows("decision_logs", limit);
    return NextResponse.json({
      ok: true,
      entries: rows.map((r) => r.payload),
      count: rows.length,
      source: "warehouse",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Fetch decision logs failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
