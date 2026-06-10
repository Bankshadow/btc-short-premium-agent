import { NextRequest, NextResponse } from "next/server";

import {

  getEvents,

  getEventsByDecisionLogId,

  getEventsByRunId,

} from "@/lib/journal/journal-query";

import { zeroJournalEventsResponse } from "@/lib/core/zero-state";



export async function GET(req: NextRequest) {

  try {

    const sp = req.nextUrl.searchParams;

    const runId = sp.get("runId");

    const decisionLogId = sp.get("decisionLogId");

    const limit = sp.get("limit") ? Number(sp.get("limit")) : undefined;



    let events = runId

      ? await getEventsByRunId(runId)

      : decisionLogId

        ? await getEventsByDecisionLogId(decisionLogId)

        : await getEvents();



    if (limit && limit > 0) {

      events = events.slice(0, limit);

    }



    return NextResponse.json({ events, total: events.length });

  } catch {

    return NextResponse.json(zeroJournalEventsResponse());

  }

}

