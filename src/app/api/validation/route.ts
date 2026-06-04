import { REGIME_ROUTER_RULES } from "@/lib/validation/regime-router";
import { VALIDATION_THRESHOLDS } from "@/lib/validation/validation-config";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** MVP 10 — validation rules & thresholds (full report is client-built from local log). */
export async function GET() {
  return NextResponse.json({
    ok: true,
    mvp: 10,
    analysisOnly: true,
    thresholds: VALIDATION_THRESHOLDS,
    regimeRouter: REGIME_ROUTER_RULES.map((r) => ({
      regime: r.regime,
      label: r.label,
      allowed: r.allowed,
      blocked: r.blocked,
      sizeMultiplier: r.sizeMultiplier,
      note: r.note,
    })),
    clientReportHint:
      "Open /validation in the browser to build the full matrix from decision log + paper orders.",
  });
}
