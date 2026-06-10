import { NextResponse } from "next/server";

import { buildMissionSnapshotView } from "@/lib/mission/build-mission-snapshot-view";

import { computeReadyForMvp5 } from "@/lib/core/mvp5-readiness";

import { defaultBinanceTestnetStatus, zeroMissionSnapshotView } from "@/lib/core/zero-state";



export async function GET() {

  try {

    const view = await buildMissionSnapshotView();

    return NextResponse.json(view);

  } catch {

    const readiness = computeReadyForMvp5({

      binanceStatus: defaultBinanceTestnetStatus(),

      events: [],

      openTradeCount: 0,

    });

    return NextResponse.json(zeroMissionSnapshotView(readiness));

  }

}

