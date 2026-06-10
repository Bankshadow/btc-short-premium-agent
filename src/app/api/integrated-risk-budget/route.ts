import { NextResponse } from "next/server";
import { buildTestnetMonitorSnapshot } from "@/lib/testnet-monitor";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await buildTestnetMonitorSnapshot();
    return NextResponse.json({
      ok: true,
      riskBudget: snapshot.integratedRiskBudget,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Integrated risk budget failed",
      },
      { status: 500 },
    );
  }
}
