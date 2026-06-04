import { DESK_PROFILES } from "@/lib/trading-os/desk-profiles";
import { TRADING_OS_DISCLAIMER } from "@/lib/trading-os/api-contract";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    mvp: 15,
    product: "AI Trading Desk OS",
    disclaimer: TRADING_OS_DISCLAIMER,
    profiles: DESK_PROFILES.map((p) => ({
      id: p.id,
      name: p.name,
      defaultMode: p.defaultEnvironmentMode,
    })),
    environmentModes: ["DEMO", "PAPER", "SEMI_LIVE", "SAFE_MODE"],
    pages: ["/workspace", "/api-docs", "/reports", "/summary"],
  });
}
