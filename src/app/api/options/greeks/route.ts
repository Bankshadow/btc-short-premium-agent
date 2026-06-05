import {
  buildOptionsRiskServerInput,
  aggregatePortfolioGreeks,
  buildGreekSnapshots,
  OPTIONS_RISK_GREEKS_SAFETY_NOTICE,
} from "@/lib/options-risk-greeks";
import type { OptionsRiskClientPayload } from "@/lib/options-risk-greeks/build-server-input";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as OptionsRiskClientPayload;
    const input = await buildOptionsRiskServerInput(body);
    const positions = buildGreekSnapshots(input);
    const portfolio = aggregatePortfolioGreeks(positions);

    return NextResponse.json({
      ok: true,
      portfolio,
      positions,
      cannotPlaceOrders: true,
      safetyNotice: OPTIONS_RISK_GREEKS_SAFETY_NOTICE,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Greeks calculation failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
