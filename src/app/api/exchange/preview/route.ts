import { previewOrderTicket, previewPerpSignal } from "@/lib/exchange/order-preview";
import type { PerpDirectionalSignal } from "@/lib/multi-asset/types";
import type { OrderTicket } from "@/lib/trade-control/trade-control-types";
import {
  enrichRealTimeRiskInput,
  evaluateAndCheckOrder,
} from "@/lib/real-time-risk";
import type { RealTimeRiskInput } from "@/lib/real-time-risk";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RiskContext = Partial<RealTimeRiskInput> & {
  isCloseOrder?: boolean;
  increaseExposure?: boolean;
};

type PreviewBody =
  | ({ source: "perp_signal"; signal: PerpDirectionalSignal } & RiskContext)
  | ({ source: "order_ticket"; ticket: OrderTicket } & RiskContext);

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
      const riskInput = await enrichRealTimeRiskInput(body);
      const riskCheck = evaluateAndCheckOrder({
        riskInput,
        preview: result,
        isCloseOrder: body.isCloseOrder,
        increaseExposure: body.increaseExposure,
      });
      return NextResponse.json({ ...result, realTimeRiskCheck: riskCheck });
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
