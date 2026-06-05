import type { PerpDirectionalSignal } from "@/lib/multi-asset/types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { GovernanceDeskState, DeskIncident } from "@/lib/governance/governance-types";
import { previewPerpSignal } from "@/lib/exchange/order-preview";
import { validatePilotPreview } from "@/lib/live-pilot/pilot-execution";
import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  signal: PerpDirectionalSignal;
  sourceSignalId?: string | null;
  decisionLogId?: string | null;
  journal?: LiveTradeJournalEntry[];
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
  governance?: GovernanceDeskState;
  incidents?: DeskIncident[];
  readinessStatus?: "PASS" | "WARNING" | "FAIL";
  emergencyStopActive?: boolean;
  riskBudget?: import("@/lib/risk-budget-optimizer/types").RiskBudgetResult | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body.signal?.symbol) {
      return NextResponse.json({ error: "signal required" }, { status: 400 });
    }

    if (body.signal.hasOptions) {
      return NextResponse.json(
        {
          ok: false,
          error: "BTC options live execution is not available.",
          btcOptionsLiveSupported: false,
        },
        { status: 422 },
      );
    }

    const preview = await previewPerpSignal(body.signal);
    const guards = validatePilotPreview(preview, body.journal ?? [], {
      entries: body.entries,
      orders: body.orders,
      governance: body.governance,
      incidents: body.incidents,
      readinessStatus: body.readinessStatus,
      emergencyStopActive: body.emergencyStopActive,
      riskBudget: body.riskBudget,
    });

    const previewId = `preview-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    return NextResponse.json({
      ok: true,
      previewId,
      preview,
      pilotGuards: guards,
      perpOnly: true,
      requiresHumanApproval: true,
      requiresDoubleConfirm: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Pilot preview failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
