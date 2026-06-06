import { executeBinanceTestnetClose } from "@/lib/exchange/binance";
import { blockBinanceProductionOrder } from "@/lib/exchange/binance/binance-config";
import type { BinanceCloseInput } from "@/lib/exchange/binance/binance-types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = BinanceCloseInput & {
  governance?: import("@/lib/governance/governance-types").GovernanceDeskState;
  commandCenter?: { status: string };
  entries?: import("@/lib/journal/decision-log-types").DecisionLogEntry[];
  orders?: import("@/lib/paper/paper-order-types").PaperOrder[];
};

export async function POST(request: Request) {
  try {
    const productionBlock = blockBinanceProductionOrder();
    if (productionBlock) {
      return NextResponse.json(
        { ok: false, error: productionBlock, productionBlocked: true },
        { status: 422 },
      );
    }

    const body = (await request.json()) as Body;
    if (!body.symbol) {
      return NextResponse.json({ error: "symbol required" }, { status: 400 });
    }

    const result = await executeBinanceTestnetClose({
      close: {
        symbol: body.symbol,
        doubleConfirm: body.doubleConfirm === true,
        operatorNote: body.operatorNote,
      },
      commandCenterStatus: body.commandCenter?.status,
      governance: body.governance,
      entries: body.entries,
      orders: body.orders,
    });

    return NextResponse.json(
      { ...result, clientMustPersistJournal: true },
      { status: result.ok ? 200 : 422 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Close failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
