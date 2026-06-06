import { NextResponse } from "next/server";
import { importGarageStrategy, STRATEGY_GARAGE_SAFETY_NOTICE } from "@/lib/strategy-garage";
import type { ImportGarageStrategyInput } from "@/lib/strategy-garage/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 81 — import strategy from GitHub, link, or manual description. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ImportGarageStrategyInput;
    if (!body.strategyName?.trim() || !body.description?.trim()) {
      return NextResponse.json(
        { ok: false, error: "strategyName and description are required" },
        { status: 400 },
      );
    }
    const strategy = await importGarageStrategy(body);
    return NextResponse.json({
      ok: true,
      mvp: 81,
      safetyNotice: STRATEGY_GARAGE_SAFETY_NOTICE,
      strategy,
      executionBlocked: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
