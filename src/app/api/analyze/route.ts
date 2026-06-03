import { runAnalyzeRequest } from "@/lib/decision/run-analyze";
import { BYBIT_API_FAILED_MESSAGE } from "@/lib/decision/bybit-health";
import type {
  AnalysisInput,
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
        AnalysisInput &
        Record<string, unknown>;
    } catch {
      // Empty body — use fetched defaults
    }

    const result = await runAnalyzeRequest(body);
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
