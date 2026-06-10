import { NextResponse } from "next/server";

import { buildReportsSummary } from "@/lib/reports/build-reports-summary";

import { computeReadyForMvp5 } from "@/lib/core/mvp5-readiness";

import { defaultBinanceTestnetStatus, zeroReportsSummary } from "@/lib/core/zero-state";



export async function GET() {

  try {

    const summary = await buildReportsSummary();

    return NextResponse.json(summary);

  } catch {

    const readiness = computeReadyForMvp5({

      binanceStatus: defaultBinanceTestnetStatus(),

      events: [],

      openTradeCount: 0,

    });

    return NextResponse.json(zeroReportsSummary(readiness));

  }

}



export async function POST() {

  return NextResponse.json(

    { error: "Reports are read-only in MVP 3." },

    { status: 403 },

  );

}

