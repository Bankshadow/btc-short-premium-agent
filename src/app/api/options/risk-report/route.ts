import {
  buildOptionsRiskReport,
  buildOptionsRiskServerInput,
  OPTIONS_RISK_GREEKS_SAFETY_NOTICE,
} from "@/lib/options-risk-greeks";
import type { OptionsRiskClientPayload } from "@/lib/options-risk-greeks/build-server-input";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const input = await buildOptionsRiskServerInput({});
    const report = buildOptionsRiskReport(input);
    return NextResponse.json({
      ok: true,
      report,
      cannotPlaceOrders: true,
      safetyNotice: OPTIONS_RISK_GREEKS_SAFETY_NOTICE,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Risk report failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let body: OptionsRiskClientPayload = {};
    try {
      body = (await request.json()) as OptionsRiskClientPayload;
    } catch {
      /* empty */
    }
    const input = await buildOptionsRiskServerInput(body);
    const report = buildOptionsRiskReport(input);
    return NextResponse.json({
      ok: true,
      report,
      cannotPlaceOrders: true,
      safetyNotice: OPTIONS_RISK_GREEKS_SAFETY_NOTICE,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Risk report failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
