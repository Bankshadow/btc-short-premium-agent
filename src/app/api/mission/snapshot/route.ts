import { NextResponse } from "next/server";

import { withLegacyApiHeaders } from "@/lib/core/legacy-api-headers";
import { buildMissionSnapshotView } from "@/lib/mission/build-mission-snapshot-view";

import { computeReadyForMvp5 } from "@/lib/core/mvp5-readiness";

import { defaultBinanceTestnetStatus, zeroMissionSnapshotView } from "@/lib/core/zero-state";



export async function GET() {

  try {

    const view = await buildMissionSnapshotView();

    return withLegacyApiHeaders(NextResponse.json(view));

  } catch {

    const readiness = computeReadyForMvp5({

      binanceStatus: defaultBinanceTestnetStatus(),

      events: [],

      openTradeCount: 0,

    });

    return withLegacyApiHeaders(NextResponse.json(zeroMissionSnapshotView(readiness)));

  }

}

