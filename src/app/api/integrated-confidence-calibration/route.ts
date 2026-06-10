import { NextResponse } from "next/server";
import { buildTestnetMonitorSnapshot } from "@/lib/testnet-monitor";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await buildTestnetMonitorSnapshot();
    return NextResponse.json({
      ok: true,
      calibration: snapshot.integratedConfidenceCalibration,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Integrated confidence calibration failed",
      },
      { status: 500 },
    );
  }
}
