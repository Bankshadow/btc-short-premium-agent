import { NextResponse } from "next/server";
import { runAnalysis } from "@/lib/analysis/analysis-runner";

export async function POST() {
  try {
    const result = await runAnalysis();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 },
    );
  }
}
