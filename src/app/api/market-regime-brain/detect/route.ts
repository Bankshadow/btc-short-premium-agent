import { loadCronAnalysisInput } from "@/lib/cron/cron-config";
import { runAnalyzeRequest } from "@/lib/decision/run-analyze";
import { buildRegimeBrainInputFromAnalyze } from "@/lib/market-regime-brain/build-brain-input";
import { buildRegimeBrainReport } from "@/lib/market-regime-brain/build-regime-report";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      entries?: DecisionLogEntry[];
      ethQuote?: import("@/lib/types/market").SpotQuote;
    };

    const cronInput = await loadCronAnalysisInput();
    const response = await runAnalyzeRequest({
      ...cronInput,
      ethQuote: body.ethQuote,
    });

    const report = buildRegimeBrainReport({
      brainInput: buildRegimeBrainInputFromAnalyze({
        response,
        partialEngine: cronInput,
        ethQuote: body.ethQuote ?? null,
        recentEntries: body.entries ?? [],
      }),
      entries: body.entries ?? [],
    });

    return NextResponse.json({
      ok: true,
      report,
      regimeBrain: report.current,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Detect failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
