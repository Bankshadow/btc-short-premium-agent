import { NextResponse } from "next/server";
import { buildTestnetMonitorSnapshot } from "@/lib/testnet-monitor/build-testnet-monitor-snapshot";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await buildTestnetMonitorSnapshot();
    return NextResponse.json({
      ok: true,
      integratedQualityCalibration: snapshot.integratedQualityCalibration,
      integratedTradeQuality: snapshot.integratedTradeQuality,
      integratedConfidenceCalibration: snapshot.integratedConfidenceCalibration,
      liveTradingLocked: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Quality calibration failed",
      },
      { status: 500 },
    );
  }
}
