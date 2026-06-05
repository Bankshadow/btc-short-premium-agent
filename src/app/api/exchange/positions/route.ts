import { buildExchangePositions } from "@/lib/exchange/build-exchange-status";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await buildExchangePositions();
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Exchange positions failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
