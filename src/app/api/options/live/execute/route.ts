import { PRODUCTION_OPTIONS_HARD_ERROR } from "@/lib/options-execution/testnet-gates";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Hard block — BTC options production/live execution is not implemented. */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: PRODUCTION_OPTIONS_HARD_ERROR,
      productionBlocked: true,
      liveImplemented: false,
    },
    { status: 403 },
  );
}
