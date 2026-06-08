import { NextResponse } from "next/server";
import {
  listScanLogs,
  PREDICTION_ARB_MVP,
  PREDICTION_ARB_SAFETY_NOTICE,
  replayScanLog,
} from "@/lib/prediction-market-arbitrage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (id) {
      const entry = replayScanLog(id);
      if (!entry) {
        return NextResponse.json({ ok: false, error: "Scan log not found" }, { status: 404 });
      }
      return NextResponse.json({
        ok: true,
        mvp: PREDICTION_ARB_MVP,
        replay: entry,
        safetyNotice: PREDICTION_ARB_SAFETY_NOTICE,
      });
    }
    return NextResponse.json({
      ok: true,
      mvp: PREDICTION_ARB_MVP,
      logs: listScanLogs(25),
      safetyNotice: PREDICTION_ARB_SAFETY_NOTICE,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Replay failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
