import { NextResponse } from "next/server";
import { buildStrategyShadowReport } from "@/lib/strategy-shadow/build-report";
import { runStrategyShadowMode } from "@/lib/strategy-shadow/run-shadow-cycle";
import { STRATEGY_SHADOW_SAFETY_NOTICE } from "@/lib/strategy-shadow/types";
import { listWarehouseRows } from "@/lib/db/repositories/warehouse-repository";
import type { PaperOrder } from "@/lib/paper/paper-order-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 70 — shadow performance report with AI comparison. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol") === "SOLUSDT" ? "SOLUSDT" : "BTCUSDT";
    const lookbackDays = Number(searchParams.get("lookbackDays") ?? "90");

    const refresh = searchParams.get("refresh") === "true";
    let aiPaperOrders: PaperOrder[] = [];
    if (refresh) {
      const run = await runStrategyShadowMode({
        symbol,
        lookbackDays: Number.isFinite(lookbackDays) ? lookbackDays : 90,
        mode: "replay",
      });
      aiPaperOrders = run.aiPaperOrders;
    } else {
      try {
        const rows = await listWarehouseRows("paper_trades", 500);
        aiPaperOrders = rows
          .map((row) => row.payload as unknown as PaperOrder)
          .filter((o) => o && !o.isDemoData && o.paperMode !== "RELAXED_PAPER");
      } catch {
        aiPaperOrders = [];
      }
    }

    const report = await buildStrategyShadowReport({
      symbol,
      lookbackDays,
      aiPaperOrders,
    });

    return NextResponse.json({
      ok: true,
      mvp: 70,
      neverPlacesOrders: true,
      cannotCountAsLiveProof: true,
      safetyNotice: STRATEGY_SHADOW_SAFETY_NOTICE,
      report,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build shadow report";
    return NextResponse.json(
      { ok: false, error: message, safetyNotice: STRATEGY_SHADOW_SAFETY_NOTICE },
      { status: 500 },
    );
  }
}
