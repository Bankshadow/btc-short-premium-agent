import { NextResponse } from "next/server";
import { buildQuantImporterCatalog } from "@/lib/quant-strategy-importer/build-catalog";
import { QUANT_IMPORT_SAFETY_NOTICE } from "@/lib/quant-strategy-importer/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 66 — quant strategy import catalog (research-only). */
export async function GET() {
  try {
    const catalog = await buildQuantImporterCatalog();
    return NextResponse.json({
      ok: true,
      mvp: 66,
      analysisOnly: true,
      noLiveExecution: true,
      noAutoTrading: true,
      cannotExecuteOrders: true,
      cannotChangeLiveSettings: true,
      humanApprovalRequired: true,
      safetyNotice: QUANT_IMPORT_SAFETY_NOTICE,
      catalog,
      clientHint: "Open /strategy-lab/imports to review imported quant strategies.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load quant import catalog";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
