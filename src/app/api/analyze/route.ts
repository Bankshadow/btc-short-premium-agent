import {
  runAnalysisEngine,
  runDecisionEngine,
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

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
