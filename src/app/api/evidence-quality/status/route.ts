import { NextResponse } from "next/server";
import { buildEvidenceQualityActivationStatus } from "@/lib/testnet-engine-activation/build-evidence-quality-status";
import { withActivationTimeout } from "@/lib/testnet-engine-activation/build-engine-health-status";
import { GOAL_MIN_TRADES_FOR_TRUST } from "@/lib/goal-engine/types";
import { TESTNET_ENGINE_ACTIVATION_MVP } from "@/lib/testnet-engine-activation/types";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

const TIMEOUT_MS = 5_000;

const TIMEOUT_FALLBACK = {
  mvp: TESTNET_ENGINE_ACTIVATION_MVP,
  status: "INSUFFICIENT" as const,
  validEvidenceCount: 0,
  requiredEvidenceCount: GOAL_MIN_TRADES_FOR_TRUST,
  invalidEvidenceCount: 0,
  evidenceConfidence: 0,
  missingFields: [] as Array<{ field: string; count: number }>,
  message: "No completed trades yet.",
  updatedAt: new Date().toISOString(),
  liveTradingLocked: true as const,
};

export async function GET() {
  try {
    const status = await withActivationTimeout(
      buildEvidenceQualityActivationStatus(),
      TIMEOUT_MS,
      { ...TIMEOUT_FALLBACK, updatedAt: new Date().toISOString() },
    );
    return NextResponse.json({ ok: true, ...status });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Evidence quality check failed",
      },
      { status: 500 },
    );
  }
}
