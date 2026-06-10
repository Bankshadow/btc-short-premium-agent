import { executeBinanceTestnetClose } from "@/lib/exchange/binance/binance-execution";
import { blockBinanceProductionOrder } from "@/lib/exchange/binance/binance-config";
import { evaluateRiskyActionGate } from "@/lib/anomaly-detection";
import { recordMonitorEvent } from "@/lib/testnet-monitor/monitor-journal-server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  positionId?: string;
  symbol: string;
  doubleConfirm: boolean;
  operatorNote?: string;
  governance?: import("@/lib/governance/governance-types").GovernanceDeskState;
  entries?: import("@/lib/journal/decision-log-types").DecisionLogEntry[];
  orders?: import("@/lib/paper/paper-order-types").PaperOrder[];
};

export async function POST(request: Request) {
  try {
    const anomalyGate = await evaluateRiskyActionGate("testnet monitor close");
    if (!anomalyGate.allowed) {
      return NextResponse.json(
        {
          ok: false,
          blocked: true,
          error: anomalyGate.reason,
          blockedByIncidents: anomalyGate.criticalIncidentIds,
        },
        { status: 422 },
      );
    }

    const liveBlock = blockBinanceProductionOrder();
    if (liveBlock) {
      return NextResponse.json(
        { ok: false, error: liveBlock, liveBlocked: true },
        { status: 422 },
      );
    }

    const body = (await request.json()) as Body;
    if (!body.symbol) {
      return NextResponse.json({ error: "symbol required" }, { status: 400 });
    }
    if (!body.doubleConfirm) {
      return NextResponse.json(
        { ok: false, error: "doubleConfirm required for reduce-only close" },
        { status: 422 },
      );
    }

    await recordMonitorEvent({
      exchange: "BINANCE",
      environment: "TESTNET",
      eventType: "CLOSE_REQUESTED",
      symbol: body.symbol,
      payload: { positionId: body.positionId ?? null },
      decisionLogId: null,
      orderId: null,
      positionId: body.positionId ?? null,
    });

    const result = await executeBinanceTestnetClose({
      close: {
        symbol: body.symbol,
        doubleConfirm: true,
        operatorNote: body.operatorNote,
      },
      governance: body.governance,
      entries: body.entries,
      orders: body.orders,
    });

    if (!result.ok) {
      await recordMonitorEvent({
        exchange: "BINANCE",
        environment: "TESTNET",
        eventType: "ERROR",
        symbol: body.symbol,
        payload: { error: result.error },
        decisionLogId: null,
        orderId: null,
        positionId: body.positionId ?? null,
      });
    }

    return NextResponse.json(
      { ...result, clientMustPersistJournal: true, monitorOnly: true },
      { status: result.ok ? 200 : 422 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Close failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
