import { NextResponse } from "next/server";

import { withLegacyApiHeaders } from "@/lib/core/legacy-api-headers";
import { zeroTradesResponse } from "@/lib/core/zero-state";

import { getTradesSummary } from "@/lib/trades/trade-query";



export async function GET() {

  try {

    const trades = await getTradesSummary();

    return withLegacyApiHeaders(NextResponse.json({

      ...trades,

      sprint: "mvp-4.6",

    }));

  } catch {

    return withLegacyApiHeaders(NextResponse.json(zeroTradesResponse()));

  }

}

