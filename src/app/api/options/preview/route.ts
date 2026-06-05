import type { AnalyzeApiResponse, OptionCandidate } from "@/lib/types/market";
import type { OrderTicket } from "@/lib/trade-control/trade-control-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { GovernanceDeskState, DeskIncident } from "@/lib/governance/governance-types";
import { buildOrderTicket } from "@/lib/trade-control/build-order-ticket";
import {
  buildOptionsOrderPreview,
  linkPaperOrderToPreview,
} from "@/lib/options-execution/build-options-preview";
import type { OptionsPreviewJournalEntry } from "@/lib/options-execution/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  ticket?: OrderTicket;
  data?: AnalyzeApiResponse;
  candidate?: OptionCandidate;
  decisionLogId?: string;
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
  paperOrders?: PaperOrder[];
  governance?: GovernanceDeskState;
  incidents?: DeskIncident[];
  journal?: OptionsPreviewJournalEntry[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;

    let ticket = body.ticket;
    if (!ticket && body.data && body.decisionLogId) {
      ticket =
        buildOrderTicket(body.data, body.decisionLogId) ?? undefined;
    }

    if (!ticket) {
      return NextResponse.json(
        { error: "Order ticket or analyze data required." },
        { status: 400 },
      );
    }

    const preview = await buildOptionsOrderPreview({
      ticket,
      data: body.data,
      candidate: body.candidate,
      entries: body.entries,
      orders: body.orders,
      governance: body.governance,
      incidents: body.incidents,
      journal: body.journal,
      paperOrders: body.paperOrders,
    });

    const paperLink = linkPaperOrderToPreview(
      preview,
      body.paperOrders ?? body.orders ?? [],
    );

    return NextResponse.json({
      ok: true,
      preview,
      paperLink,
      previewOnly: true,
      realExecutionDisabled: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Options preview failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
