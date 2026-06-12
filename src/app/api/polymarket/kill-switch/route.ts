import { loadPolymarketConfig } from "@/lib/polymarket/config";
import { setPolymarketKillSwitch } from "@/lib/polymarket/run-cycle";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Body = { active?: boolean; doubleConfirm?: boolean };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body.doubleConfirm) {
      return NextResponse.json(
        { ok: false, error: "doubleConfirm required for kill switch." },
        { status: 400 },
      );
    }
    const active = Boolean(body.active);
    setPolymarketKillSwitch(active);
    const config = loadPolymarketConfig();
    return NextResponse.json({
      ok: true,
      killSwitchActive: config.killSwitchActive,
      message: active ? "Polymarket kill switch enabled." : "Polymarket kill switch disabled.",
      realTradingEnabled: false,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Kill switch failed" },
      { status: 500 },
    );
  }
}

export async function GET() {
  const config = loadPolymarketConfig();
  return NextResponse.json({
    ok: true,
    killSwitchActive: config.killSwitchActive,
    realTradingEnabled: false,
  });
}
