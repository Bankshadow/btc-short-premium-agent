import {
  runAnalysisEngine,
  runDecisionEngineFromInput,
} from "@/lib/decision/analyze";
import { BYBIT_API_FAILED_MESSAGE } from "@/lib/decision/bybit-health";
import type {
  AnalysisInput,
  AnalyzeApiResponse,
  DecisionEngineInput,
} from "@/lib/types/market";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    let body: Partial<DecisionEngineInput> & AnalysisInput = {};

    try {
      body = (await request.json()) as Partial<DecisionEngineInput> &
        AnalysisInput;
    } catch {
      // Empty body — use fetched defaults
    }

    const hasFullInput =
      body.market &&
      body.optionCandidates &&
      body.technicalDaily &&
      body.technical4h &&
      body.technical1h &&
      body.macroEvent &&
      body.liquidation;

    const result: AnalyzeApiResponse = hasFullInput
      ? runDecisionEngineFromInput(
          body as DecisionEngineInput,
          body.derivativesOverrides,
        )
      : await runAnalysisEngine(body);

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Analysis failed";
    const isBybit =
      message.toLowerCase().includes("bybit") ||
      message.includes("BTCUSDT ticker");
    return NextResponse.json(
      { error: isBybit ? BYBIT_API_FAILED_MESSAGE : message },
      { status: 500 },
    );
  }
}
