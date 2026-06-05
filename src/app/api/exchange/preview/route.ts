import { previewOrderTicket, previewPerpSignal } from "@/lib/exchange/order-preview";
import type { PerpDirectionalSignal } from "@/lib/multi-asset/types";
import type { OrderTicket } from "@/lib/trade-control/trade-control-types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PreviewBody =
  | { source: "perp_signal"; signal: PerpDirectionalSignal }
  | { source: "order_ticket"; ticket: OrderTicket };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PreviewBody;

    if (body.source === "perp_signal") {
      if (!body.signal?.symbol) {
        return NextResponse.json(
          { error: "Missing perp signal" },
          { status: 400 },
        );
      }
      const result = await previewPerpSignal(body.signal);
      return NextResponse.json(result);
    }

    if (body.source === "order_ticket") {
      if (!body.ticket?.id) {
        return NextResponse.json(
          { error: "Missing order ticket" },
          { status: 400 },
        );
      }
      const result = await previewOrderTicket(body.ticket);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "Invalid source — use perp_signal or order_ticket" },
      { status: 400 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Order preview failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
