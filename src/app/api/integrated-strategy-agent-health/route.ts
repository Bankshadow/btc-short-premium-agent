import { NextResponse } from "next/server";
import { buildTestnetMonitorSnapshot } from "@/lib/testnet-monitor/build-testnet-monitor-snapshot";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await buildTestnetMonitorSnapshot();
    return NextResponse.json({
      ok: true,
      integratedStrategyAgentHealth: snapshot.integratedStrategyAgentHealth,
      liveTradingLocked: true,
      humanApprovalRequired: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Strategy agent health failed",
      },
      { status: 500 },
    );
  }
}
