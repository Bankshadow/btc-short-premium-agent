import { getPolymarketDashboard } from "@/lib/polymarket/run-cycle";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = getPolymarketDashboard();
  return NextResponse.json({ ok: true, health: data.health });
}
