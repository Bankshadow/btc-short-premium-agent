import { NextResponse } from "next/server";
import { getTradeBlackBoxStatus } from "@/lib/trade-black-box/run-capture";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const status = await getTradeBlackBoxStatus();
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Black box status failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
