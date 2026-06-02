import {
  runAnalysisEngine,
  runDecisionEngine,
  BYBIT_API_FAILED_MESSAGE,
  isBybitCriticalFailure,
} from "@/lib/decision/analyze";
import { buildAnalyzeApiResponse } from "@/lib/decision/analyze-response";
import type {
  AnalysisInput,
  AnalyzeApiResponse,
  DecisionEngineInput,
} from "@/lib/types/market";
import { NextResponse } from "next/server";

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
      ? buildAnalyzeApiResponse(
          runDecisionEngine(body as DecisionEngineInput),
          [],
        )
      : await runAnalysisEngine(body);

    if (isBybitCriticalFailure(result.marketSnapshot, result.dataSourceIssues)) {
      return NextResponse.json(
        { error: BYBIT_API_FAILED_MESSAGE },
        { status: 503 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Analysis failed";
    const isBybit =
      message.toLowerCase().includes("bybit") ||
      message.includes("BTCUSDT ticker");
    return NextResponse.json(
      { error: isBybit ? BYBIT_API_FAILED_MESSAGE : message },
      { status: isBybit ? 503 : 500 },
    );
  }
}
