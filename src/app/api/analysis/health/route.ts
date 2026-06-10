import { NextResponse } from "next/server";
import {
  buildEngineActivationHealthStatus,
  withActivationTimeout,
} from "@/lib/testnet-engine-activation/build-engine-health-status";
import { buildAnalysisEngineHealthSnapshot } from "@/lib/analysis-engine-health/build-engine-health";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

const TIMEOUT_MS = 5_000;

const TIMEOUT_FALLBACK = {
  mvp: 95 as const,
  status: "WARNING" as const,
  checks: [
    {
      id: "health_timeout",
      name: "Health check timeout",
      status: "WARNING" as const,
      reason: "Engine health check exceeded 5s — partial results only.",
      lastCheckedAt: new Date().toISOString(),
    },
  ],
  blockers: [] as string[],
  warnings: ["Health check timed out after 5 seconds."],
  updatedAt: new Date().toISOString(),
  liveTradingLocked: true as const,
};

/** MVP 95 — fast activation health (≤5s) with legacy snapshot optional. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const legacy = url.searchParams.get("legacy") === "1";

  try {
    const activation = await withActivationTimeout(
      buildEngineActivationHealthStatus(),
      TIMEOUT_MS,
      TIMEOUT_FALLBACK,
    );

    if (legacy) {
      const snapshot = await buildAnalysisEngineHealthSnapshot().catch(() => null);
      return NextResponse.json({
        ok: true,
        ...activation,
        snapshot,
        liveTradingLocked: true,
      });
    }

    return NextResponse.json({
      ok: true,
      ...activation,
      liveTradingLocked: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Engine health check failed",
      },
      { status: 500 },
    );
  }
}
