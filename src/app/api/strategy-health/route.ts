import { NextResponse } from "next/server";
import { buildStrategyHealthSummary } from "@/lib/strategy-health";
import { buildStrategyHealthInputServer } from "@/lib/strategy-health/build-server-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const input = await buildStrategyHealthInputServer();
    const summary = buildStrategyHealthSummary(input);
    return NextResponse.json({
      ok: true,
      summary,
      hint: "Status/recommendation are advisory and remain simulation/read-only.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Strategy health failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
