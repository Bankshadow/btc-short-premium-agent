import { NextResponse } from "next/server";

import { getLatestAnalysis } from "@/lib/analysis/analysis-runner";

import { zeroAnalysisLatest } from "@/lib/core/zero-state";



export async function GET() {

  try {

    const latest = await getLatestAnalysis();

    return NextResponse.json(latest);

  } catch {

    return NextResponse.json(zeroAnalysisLatest());

  }

}

