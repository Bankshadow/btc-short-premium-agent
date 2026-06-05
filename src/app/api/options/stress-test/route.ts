import {
  buildStressTestReport,
  buildOptionsRiskServerInput,
  OPTIONS_RISK_GREEKS_SAFETY_NOTICE,
} from "@/lib/options-risk-greeks";
import type { OptionsRiskClientPayload } from "@/lib/options-risk-greeks/build-server-input";
import type { StressTestInput } from "@/lib/options-risk-greeks/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = OptionsRiskClientPayload & {
  priceMovesPct?: number[];
  volExpansionPct?: number[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const input = await buildOptionsRiskServerInput(body);
    const report = buildStressTestReport({
      ...input,
      priceMovesPct: body.priceMovesPct,
      volExpansionPct: body.volExpansionPct,
    } as StressTestInput);

    return NextResponse.json({
      ok: true,
      report,
      stressScenarios: report.stressScenarios,
      cannotPlaceOrders: true,
      safetyNotice: OPTIONS_RISK_GREEKS_SAFETY_NOTICE,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Stress test failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
