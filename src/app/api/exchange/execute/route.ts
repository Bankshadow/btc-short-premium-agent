import { executeLivePerpOrder } from "@/lib/exchange/live-execution-gate";
import { evaluateRiskyActionGate } from "@/lib/anomaly-detection";
import type { PerpDirectionalSignal } from "@/lib/multi-asset/types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ExecuteBody = {
  signal: PerpDirectionalSignal;
  confirmToken: string;
  confirmExpiresAt: string;
  doubleConfirm: boolean;
  operatorNote?: string;
  entries?: DecisionLogEntry[];
};

export async function POST(request: Request) {
  try {
    const anomalyGate = await evaluateRiskyActionGate("live exchange execute");
    if (!anomalyGate.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: anomalyGate.reason,
          blockedByIncidents: anomalyGate.criticalIncidentIds,
        },
        { status: 422 },
      );
    }

    const body = (await request.json()) as ExecuteBody;
    if (!body.signal?.symbol || !body.confirmToken || !body.confirmExpiresAt) {
      return NextResponse.json(
        { error: "Missing signal, confirmToken, or confirmExpiresAt" },
        { status: 400 },
      );
    }

    const result = await executeLivePerpOrder({
      signal: body.signal,
      confirmToken: body.confirmToken,
      confirmExpiresAt: body.confirmExpiresAt,
      doubleConfirm: body.doubleConfirm === true,
      operatorNote: body.operatorNote,
      entries: body.entries,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Live execute failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
