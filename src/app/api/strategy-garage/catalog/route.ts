import { NextResponse } from "next/server";
import {
  buildStrategyGarageCatalog,
  STRATEGY_GARAGE_SAFETY_NOTICE,
} from "@/lib/strategy-garage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 81 — unified strategy garage catalog. */
export async function GET() {
  try {
    const catalog = await buildStrategyGarageCatalog();
    return NextResponse.json({
      ok: true,
      mvp: 81,
      safetyNotice: STRATEGY_GARAGE_SAFETY_NOTICE,
      cannotExecuteOrders: true,
      humanApprovalRequiredForAiLoop: true,
      catalog,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Garage catalog failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
