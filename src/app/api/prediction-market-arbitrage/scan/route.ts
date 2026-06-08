import { NextResponse } from "next/server";
import {
  PREDICTION_ARB_MVP,
  PREDICTION_ARB_SAFETY_NOTICE,
  runPredictionArbScan,
} from "@/lib/prediction-market-arbitrage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const mockOnly = url.searchParams.get("mockOnly") === "true";
    const result = await runPredictionArbScan({ mockOnly, preferLive: !mockOnly });
    return NextResponse.json({
      ok: true,
      mvp: PREDICTION_ARB_MVP,
      result,
      safetyNotice: PREDICTION_ARB_SAFETY_NOTICE,
      simulationOnly: true,
      cannotExecuteOrders: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let mockOnly = false;
    try {
      const body = (await request.json()) as { mockOnly?: boolean };
      mockOnly = Boolean(body?.mockOnly);
    } catch {
      mockOnly = false;
    }
    const result = await runPredictionArbScan({ mockOnly, preferLive: !mockOnly });
    return NextResponse.json({
      ok: true,
      mvp: PREDICTION_ARB_MVP,
      result,
      safetyNotice: PREDICTION_ARB_SAFETY_NOTICE,
      simulationOnly: true,
      cannotExecuteOrders: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
