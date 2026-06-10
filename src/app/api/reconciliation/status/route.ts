import { NextResponse } from "next/server";
import { buildReconciliationStatus } from "@/lib/testnet-engine-activation/build-reconciliation-status";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET() {
  try {
    const status = await buildReconciliationStatus();
    return NextResponse.json({ ok: true, ...status });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Reconciliation check failed",
      },
      { status: 500 },
    );
  }
}
