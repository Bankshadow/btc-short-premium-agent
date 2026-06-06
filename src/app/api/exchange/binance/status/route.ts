import { getBinanceStatus } from "@/lib/exchange/binance";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const status = await getBinanceStatus();
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Status failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
