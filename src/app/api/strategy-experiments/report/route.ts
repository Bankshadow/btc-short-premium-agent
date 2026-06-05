import { buildExperimentLabReport } from "@/lib/strategy-experiments/build-report";
import { EXPERIMENT_SAFETY_NOTICE } from "@/lib/strategy-experiments/types";
import type { ExperimentAuditEntry, StrategyExperiment } from "@/lib/strategy-experiments/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    cannotPlaceLiveTrades: true,
    cannotChangeActiveWithoutApproval: true,
    safetyNotice: EXPERIMENT_SAFETY_NOTICE,
    hint: "POST experiments + auditLog to build lab report.",
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      experiments?: StrategyExperiment[];
      auditLog?: ExperimentAuditEntry[];
    };

    const report = buildExperimentLabReport(
      body.experiments ?? [],
      body.auditLog ?? [],
    );

    return NextResponse.json({
      ok: true,
      report,
      cannotPlaceLiveTrades: true,
      cannotChangeActiveWithoutApproval: true,
      safetyNotice: EXPERIMENT_SAFETY_NOTICE,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Experiment report failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
